import { useState, useCallback, useEffect, useRef } from 'react'
import { getExecution, transitionExecution, registerCheckpoint, completeExecution } from '@/modules/rondas/services/rondaExecutionService'
import { startExecution } from '@/modules/rondas/services/rondaExecutionService'
import { RONDA_STATES, isTerminalState, isActiveState } from '@/modules/rondas/stateMachine/rondaStateMachine'
import { useRondaTimer } from './useRondaTimer'
import { useCheckpointValidation } from './useCheckpointValidation'
import { useGeolocation, useMapTracking } from '@/modules/maps/hooks'
import { updateLivePosition, appendTrackPoint } from '@/modules/maps/services/trackingService'

/**
 * SentinelOps — useRondaExecution Hook
 * Master orchestrator for a guard executing a ronda
 * 
 * Composes: GPS tracking, checkpoint validation, timer, state machine
 * This is the central hook that ties everything together.
 */

const LOG_PREFIX = '[useRondaExecution]'
const POSITION_SYNC_INTERVAL = 10000 // 10 seconds

/**
 * @param {object} options
 * @param {string} options.assignmentId
 * @param {string} options.rondaId
 * @param {string} options.routeId
 * @param {string} options.guardId
 * @param {object[]} options.checkpoints - Ordered checkpoint objects
 * @param {number} options.scheduledEnd - Unix timestamp
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
    geofencePolygon = null,
  } = options

  const [executionId, setExecutionId] = useState(null)
  const [execution, setExecution] = useState(null)
  const [status, setStatus] = useState(RONDA_STATES.AVAILABLE)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const syncIntervalRef = useRef(null)

  const checkpointOrder = checkpoints.map((cp) => cp.id)

  // ─── Composed hooks ───
  const geo = useGeolocation({ enableWatch: false })
  const tracking = useMapTracking({ maxTrailLength: 1000 })
  const timer = useRondaTimer({
    scheduledEnd,
    isRunning: isActiveState(status),
    startTime: execution?.startedAt?.toMillis?.() || execution?.startedAt,
  })
  const validation = useCheckpointValidation({
    checkpoints,
    checkpointOrder,
    geofencePolygon,
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

        // Start GPS tracking
        geo.startTracking()
        tracking.startRecording()

        console.log(`${LOG_PREFIX} ✅ Ronda started: ${execId}`)
      })
    } catch (err) {
      console.error(`${LOG_PREFIX} ❌ Error starting ronda:`, err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [assignmentId, rondaId, routeId, guardId, checkpointOrder, geo, tracking])

  // ─── Register checkpoint ───
  const registerCheckpointHit = useCallback(
    async (checkpointId) => {
      if (!executionId || !geo.position) {
        setError('GPS no disponible')
        return { success: false }
      }

      // Validate
      const result = validation.validate(checkpointId, geo.position, geo.accuracy)

      if (!result.canComplete) {
        setError(result.reason)
        return { success: false, validation: result }
      }

      try {
        await registerCheckpoint(
          executionId,
          checkpointId,
          geo.position,
          result.results.proximity.distance
        )

        validation.markCompleted(checkpointId)
        setError(null)

        console.log(`${LOG_PREFIX} ✓ Checkpoint ${checkpointId} validated`)

        // Check if all checkpoints done
        if (validation.completedCount + 1 === checkpoints.length) {
          await finishRonda()
        }

        return { success: true, validation: result }
      } catch (err) {
        console.error(`${LOG_PREFIX} Error registering checkpoint:`, err)
        setError('Error registrando checkpoint')
        return { success: false, error: err }
      }
    },
    [executionId, geo.position, geo.accuracy, validation, checkpoints.length]
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

  // ─── Finish/complete ronda ───
  const finishRonda = useCallback(async () => {
    if (!executionId) return
    try {
      geo.stopTracking()
      const trailData = tracking.stopRecording()

      await completeExecution(executionId, status, geo.position, scheduledEnd)

      const finalState = Date.now() > scheduledEnd ? RONDA_STATES.LATE : RONDA_STATES.COMPLETED
      setStatus(finalState)

      console.log(`${LOG_PREFIX} ✅ Ronda finished: ${finalState}`)
    } catch (err) {
      setError(err.message)
    }
  }, [executionId, status, geo, tracking, scheduledEnd])

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
  useEffect(() => {
    if (status === RONDA_STATES.IN_PROGRESS && geo.position && executionId) {
      // Feed position to tracking hook
      tracking.addPosition(geo.position)

      // Sync to Firestore
      if (!syncIntervalRef.current) {
        syncIntervalRef.current = setInterval(() => {
          if (geo.position) {
            updateLivePosition(guardId, geo.position, {
              accuracy: geo.accuracy,
              heading: geo.heading,
              speed: geo.speed,
            })
            appendTrackPoint(executionId, geo.position, geo.accuracy)
          }
        }, POSITION_SYNC_INTERVAL)
      }
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
        syncIntervalRef.current = null
      }
    }
  }, [status, geo.position, executionId, guardId])

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
    pause,
    resume,
    finishRonda,
    cancel,
    registerCheckpointHit,
  }
}
