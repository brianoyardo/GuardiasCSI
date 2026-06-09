import { useState, useCallback, useEffect, useRef } from 'react'
import { getExecution, transitionExecution, registerCheckpoint, completeExecution, updateExecutionPosition } from '@/modules/rondas/services/rondaExecutionService'
import { startExecution } from '@/modules/rondas/services/rondaExecutionService'
import { RONDA_STATES, isTerminalState, isActiveState } from '@/modules/rondas/stateMachine/rondaStateMachine'
import { useRondaTimer } from './useRondaTimer'
import { useCheckpointValidation } from './useCheckpointValidation'
import { useGeolocation, useMapTracking } from '@/modules/maps/hooks'
import { updateLivePosition, appendTrackPoint } from '@/modules/maps/services/trackingService'
import { POSITION_SYNC_INTERVAL } from '@/config/constants'
import { getGeofences } from '@/modules/spatial/services/spatialService'

// ─── ALGORITMO DE RAY-CASTING (Point in Polygon) ───
// Función pura para determinar si un punto está dentro de un polígono
const isPointInPolygon = (point, polygon) => {
  if (!polygon || polygon.length === 0) return true // Failsafe
  let isInside = false
  const x = point.lng
  const y = point.lat

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat
    const xj = polygon[j].lng, yj = polygon[j].lat

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) isInside = !isInside
  }
  return isInside
}

// ─── FÓRMULA DE HAVERSINE (Distancia GPS en metros) ───
// Calcula la distancia entre dos coordenadas para filtrar deriva de GPS
const haversineDistance = (a, b) => {
  const R = 6371000 // Radio de la Tierra en metros
  const toRad = (deg) => deg * (Math.PI / 180)
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const aVal =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal))
}

/**
 * SentinelOps — useRondaExecution Hook
 * Master orchestrator for a guard executing a ronda
 * 
 * Composes: GPS tracking, checkpoint validation, timer, state machine
 * This is the central hook that ties everything together.
 */

const LOG_PREFIX = '[useRondaExecution]'

/**
 * @param {object} options
 * @param {string} options.assignmentId
 * @param {string} options.rondaId
 * @param {string} options.routeId
 * @param {string} options.guardId
 * @param {object[]} options.checkpoints - Ordered checkpoint objects
 * @param {number} options.scheduledEnd - Unix timestamp
 * @param {string} [options.executionId] - Pre-existing execution ID (voice validation flow)
 * @param {{ lat: number, lng: number }[]} [options.geofencePolygon]
 */
export function useRondaExecution(options) {
  const {
    assignmentId,
    rondaId,
    routeId,
    guardId,
    checkpoints = [],
    scheduledEnd,
    executionId: preExistingExecutionId = null,
    geofencePolygon = null,
    initialCompletedIds = [],
    initialTrail = [],
  } = options

  const [executionId, setExecutionId] = useState(preExistingExecutionId)
  const [execution, setExecution] = useState(null)
  const [status, setStatus] = useState(preExistingExecutionId ? RONDA_STATES.IN_PROGRESS : RONDA_STATES.AVAILABLE)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const syncIntervalRef = useRef(null)

  const checkpointOrder = checkpoints.map((cp) => cp.id)

  // ─── Composed hooks ───
  const geo = useGeolocation({ enableWatch: false })
  const tracking = useMapTracking({ maxTrailLength: 1000, initialTrail })
  const timer = useRondaTimer({
    scheduledEnd,
    isRunning: isActiveState(status),
    startTime: execution?.startedAt?.toMillis?.() || execution?.startedAt,
  })
  const validation = useCheckpointValidation({
    checkpoints,
    checkpointOrder,
    geofencePolygon,
    initialCompletedIds,
  })

  // ─── Start ronda ───
  const start = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Get current position first
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos),
          (err) => reject(new Error('GPS requerido para iniciar ronda')),
          { enableHighAccuracy: true, timeout: 10000 }
        )
      }).then(async (pos) => {
        const startPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }

        const execId = await startExecution({
          assignmentId,
          rondaId,
          routeId,
          guardId,
          checkpointIds: checkpointOrder,
          startPosition: startPos,
        })

        setExecutionId(execId)
        setStatus(RONDA_STATES.IN_PROGRESS)

        geo.startTracking()
        tracking.startRecording()
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [assignmentId, rondaId, routeId, guardId, checkpointOrder, geo, tracking])

  // ─── Activate existing execution (after voice validation) ───
  const startWithExecutionId = useCallback(async (existingExecId) => {
    setExecutionId(existingExecId)
    setStatus(RONDA_STATES.IN_PROGRESS)

    // Get current position and start tracking
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => reject(new Error('GPS no disponible')),
          { enableHighAccuracy: true, timeout: 10000 }
        )
      })

      geo.startTracking()
      tracking.startRecording()

      updateExecutionPosition(existingExecId, pos, pos.coords?.accuracy)
    } catch (err) {
      setError(err.message)
    }
  }, [geo, tracking])

  // ─── Finish/complete ronda ───
  const finishRonda = useCallback(async () => {
    if (!executionId) return
    try {
      geo.stopTracking()
      tracking.stopRecording()

      await completeExecution(executionId, status, geo.position)

      setStatus(RONDA_STATES.COMPLETED)
    } catch (err) {
      setError(err.message)
    }
  }, [executionId, status, geo, tracking])

  const completedCountRef = useRef(0)

  useEffect(() => {
    if (validation.completedCount === checkpoints.length && checkpoints.length > 0 && validation.completedCount > 0) {
      finishRonda()
    }
  }, [validation.completedCount, checkpoints.length])

  // ─── Register checkpoint ───
  const registerCheckpointHit = useCallback(
    async (checkpointId) => {
      if (!executionId || !geo.position) {
        const errMsg = !executionId ? 'No hay executionId activo' : 'GPS no disponible'
        setError(errMsg)
        return { success: false, reason: errMsg }
      }

      const cp = checkpoints.find((c) => c.id === checkpointId)
      if (!cp) {
        const errMsg = `Checkpoint ID "${checkpointId}" no existe en la lista`
        setError(errMsg)
        return { success: false, reason: errMsg }
      }

      const validatedId = cp.checkpointId || cp.id

      const result = validation.validate(checkpointId, geo.position, geo.accuracy)

      if (!result.canComplete) {
        setError(result.reason)
        return { success: false, validation: result }
      }

      try {
        await registerCheckpoint(
          executionId,
          validatedId,
          geo.position,
          result.results.proximity.distance
        )

        validation.markCompleted(checkpointId)
        setError(null)

        return { success: true, validation: result }
      } catch (err) {
        const userMsg = err?.code === 'permission-denied'
          ? 'Error de permisos. Contacte al administrador.'
          : err?.code === 'not-found'
          ? 'La ejecución no existe en la base de datos.'
          : `Error registrando checkpoint: ${err?.message || 'Error desconocido'}`
        setError(userMsg)
        return { success: false, error: err, reason: userMsg }
      }
    },
    [executionId, geo.position, geo.accuracy, validation, checkpoints, finishRonda]
  )

  // ─── Pause ronda ───
  const pause = useCallback(async () => {
    if (!executionId) return
    try {
      await transitionExecution(executionId, status, RONDA_STATES.PAUSED, {
        position: geo.position,
      })
      setStatus(RONDA_STATES.PAUSED)
      geo.stopTracking()
    } catch (err) {
      setError(err.message)
    }
  }, [executionId, status, geo])

  // ─── Resume ronda ───
  const resume = useCallback(async () => {
    if (!executionId) return
    try {
      await transitionExecution(executionId, status, RONDA_STATES.IN_PROGRESS, {
        position: geo.position,
      })
      setStatus(RONDA_STATES.IN_PROGRESS)
      geo.startTracking()
    } catch (err) {
      setError(err.message)
    }
  }, [executionId, status, geo])

  // ─── Cancel ronda ───
  const cancel = useCallback(async (reason = '') => {
    if (!executionId) return
    try {
      await transitionExecution(executionId, status, RONDA_STATES.CANCELLED, {
        position: geo.position,
        reason,
      })
      setStatus(RONDA_STATES.CANCELLED)
      geo.stopTracking()
      tracking.stopRecording()
    } catch (err) {
      setError(err.message)
    }
  }, [executionId, status, geo, tracking])

  // ─── Sync GPS position to Firestore periodically ───
  const latestGeoRef = useRef({ position: null, accuracy: null, heading: null, speed: null })

  // Keep latest coordinates synchronized in Ref without triggering effect re-runs
  useEffect(() => {
    latestGeoRef.current = {
      position: geo.position,
      accuracy: geo.accuracy,
      heading: geo.heading,
      speed: geo.speed,
    }
  }, [geo.position, geo.accuracy, geo.heading, geo.speed])

  // Feed positions to tracking hook for local state rendering
  useEffect(() => {
    if (status === RONDA_STATES.IN_PROGRESS && geo.position) {
      tracking.addPosition(geo.position)
    }
  }, [status, geo.position])

  // Setup periodic sync interval (5 seconds to optimize Firestore writes)
  useEffect(() => {
    if (status === RONDA_STATES.IN_PROGRESS && executionId) {
      const intervalId = setInterval(() => {
        const { position, accuracy, heading, speed } = latestGeoRef.current
        if (position) {
          updateLivePosition(guardId, position, {
            accuracy,
            heading,
            speed,
          })
          appendTrackPoint(executionId, position, accuracy)
          updateExecutionPosition(executionId, position, accuracy)
        }
      }, 5000)

      return () => {
        clearInterval(intervalId)
      }
    }
  }, [status, executionId, guardId])

  // ─── CARGA DINÁMICA DE GEOCERCA ───
  const activePolygonRef = useRef(null)

  useEffect(() => {
    if (!routeId) return
    const fetchAssignedGeofence = async () => {
      try {
        const allGeofences = await getGeofences()
        const assigned = allGeofences.find(g => g.routeId === routeId)
        if (assigned && assigned.geometry && assigned.geometry.coordinatesFirestore) {
          activePolygonRef.current = assigned.geometry.coordinatesFirestore
        }
      } catch (err) {
        console.error(`${LOG_PREFIX} Error cargando geocerca:`, err)
      }
    }
    fetchAssignedGeofence()
  }, [routeId])

  // ─── ABANDONO DE GEOCERCA + INACTIVIDAD PROLONGADA (n8n Webhook unificado) ───
  const WEBHOOK_URL = "http://192.168.1.6:5678/webhook-test/alerta-operativa"
  const MOVEMENT_THRESHOLD_M = 15    // metros mínimos para considerar movimiento real
  const INACTIVITY_THRESHOLD_MS = 30000 // 30 s (QA); cambiar a 300000 para producción

  const isOutdoorsRef = useRef(false)
  const lastMoveCoordsRef = useRef(null)  // { lat, lng } del último movimiento significativo
  const lastMoveTimeRef = useRef(null)    // Date.now() del último movimiento significativo
  const inactivityAlertFiredRef = useRef(false) // Anti-spam para alerta de inactividad

  useEffect(() => {
    // ── Salida temprana ──────────────────────────────────────────────────────
    if (status !== RONDA_STATES.IN_PROGRESS) return
    if (!geo.position) return
    if (!activePolygonRef.current) return

    const currentLat = geo.position.lat
    const currentLng = geo.position.lng
    const currentPos = { lat: currentLat, lng: currentLng }

    // ── 1. DETECTOR DE GEOCERCA ──────────────────────────────────────────────
    const isInside = isPointInPolygon(currentPos, activePolygonRef.current)

    if (!isInside) {
      if (!isOutdoorsRef.current) {
        isOutdoorsRef.current = true // Anti-Spam: dispara solo una vez al salir

        fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipoEvento: "Abandono de Geocerca",
            nombreGuardia: guardId,
            horaExacta: new Date().toLocaleString("es-BO"),
            coordenadas: currentPos,
          })
        }).catch(console.error)
      }
    } else {
      if (isOutdoorsRef.current) {
        isOutdoorsRef.current = false // Reset: el guardia volvió al área permitida
      }
    }

    // ── 2. DETECTOR DE INACTIVIDAD PROLONGADA ────────────────────────────────
    if (!lastMoveCoordsRef.current) {
      // Primera posición recibida: inicializar referencias de movimiento
      lastMoveCoordsRef.current = currentPos
      lastMoveTimeRef.current = Date.now()
      return
    }

    const distanceMoved = haversineDistance(lastMoveCoordsRef.current, currentPos)

    if (distanceMoved > MOVEMENT_THRESHOLD_M) {
      // Movimiento real detectado (supera el drift del GPS)
      lastMoveCoordsRef.current = currentPos
      lastMoveTimeRef.current = Date.now()
      inactivityAlertFiredRef.current = false // Reset Anti-Spam
    } else {
      // Guardia no se ha movido significativamente
      const timeElapsed = Date.now() - lastMoveTimeRef.current

      if (timeElapsed > INACTIVITY_THRESHOLD_MS && !inactivityAlertFiredRef.current) {
        inactivityAlertFiredRef.current = true // Anti-Spam: dispara solo una vez

        fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipoEvento: "Inactividad Prolongada",
            nombreGuardia: guardId,
            horaExacta: new Date().toLocaleString("es-BO"),
            coordenadas: currentPos,
            tiempoInactivoSegundos: Math.floor(timeElapsed / 1000),
          })
        }).catch(console.error)
      }
    }
  }, [status, geo.position, guardId])

  return {
    // State
    executionId,
    status,
    isActive: isActiveState(status),
    isTerminal: isTerminalState(status),
    isPaused: status === RONDA_STATES.PAUSED,
    error,
    isLoading,

    // GPS
    position: geo.position,
    accuracy: geo.accuracy,
    isTracking: geo.isTracking,

    // Timer
    timer,

    // Checkpoints
    validation,
    nextCheckpoint: validation.nextCheckpoint,
    progress: validation.progress,

    // Trail
    trail: tracking.trail,
    metrics: tracking.metrics,

    // Actions
    start,
    startWithExecutionId,
    pause,
    resume,
    finishRonda,
    cancel,
    registerCheckpointHit,
  }
}
