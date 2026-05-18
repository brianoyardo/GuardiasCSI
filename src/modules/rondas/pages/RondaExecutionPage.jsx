import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS } from '@/config/constants'
import { useAuth } from '@/modules/auth/context/AuthContext'
import { useRondaExecution } from '@/modules/rondas/hooks/useRondaExecution'
import { startExecution, getExecution, findActiveExecutionByAssignment } from '@/modules/rondas/services/rondaExecutionService'
import { getAssignment } from '@/modules/rondas/services/rondaAssignmentService'
import { getRoute, getCheckpointsByRoute } from '@/modules/spatial/services/spatialService'
import { STATE_LABELS, STATE_COLORS, RONDA_STATES } from '@/modules/rondas/stateMachine/rondaStateMachine'
import { BaseMap, CheckpointLayer, TrackingLayer, GuardMarker } from '@/modules/maps'
import { useMapControlStore } from '@/stores/mapControlStore'
import PreOpModal from '@/modules/rondas/components/PreOpModal/PreOpModal'
import VoiceValidationModal from '@/modules/rondas/components/VoiceValidationModal/VoiceValidationModal'
import { VOICE_PASSPHRASES } from '@/config/constants'
import './RondaExecutionPage.css'

/**
 * RondaExecutionPage — Mobile tactical execution center
 * 
 * Flow (Catar Seguridad Integral):
 *   1. Pre-Operational Modal → collect patrol type, vehicle, shift
 *   2. Voice Validation Modal → biometric anti-spoofing
 *   3. Normal Execution UI → checkpoints, GPS tracking, map
 * 
 * Layout: Status Bar → Map → Bottom Panel
 */

/**
 * Convert checkpoint geometry to flat format for CheckpointLayer
 */
function checkpointToFlat(cp) {
  if (!cp.geometry || !cp.geometry.coordinates) return null
  const [lng, lat] = cp.geometry.coordinates
  return {
    id: cp.id,
    name: cp.name,
    lat,
    lng,
    order: cp.order || 0,
  }
}

export default function RondaExecutionPage() {
  const { executionId: paramId } = useParams()
  const { user } = useAuth()
  const [feedback, setFeedback] = useState(null)
  const triggerFlyTo = useMapControlStore((s) => s.triggerFlyTo)
  const hasCentered = useRef(false)

  // ─── Real Data Loading ───
  const [loading, setLoading] = useState(true)
  const [assignment, setAssignment] = useState(null)
  const [route, setRoute] = useState(null)
  const [checkpoints, setCheckpoints] = useState([])
  const [initialCompletedIds, setInitialCompletedIds] = useState([])
  const [initialTrail, setInitialTrail] = useState([])

  useEffect(() => {
    if (!paramId) return

    async function loadData() {
      try {
        const assign = await getAssignment(paramId)
        if (!assign) {
          setFeedback({ type: 'error', message: 'Asignación no encontrada' })
          setLoading(false)
          return
        }
        setAssignment(assign)

        if (assign.routeId) {
          const [r, cps] = await Promise.all([
            getRoute(assign.routeId),
            getCheckpointsByRoute(assign.routeId),
          ])
          if (r) setRoute(r)
          setCheckpoints(cps.filter(Boolean).map(checkpointToFlat).filter(Boolean))
        }

        // ─── FAST PATH Bypass: Active assignment with executionId → skip all queries ───
        if (assign.status === RONDA_STATES.IN_PROGRESS || assign.status === RONDA_STATES.PAUSED) {
          if (assign.executionId) {
            console.log('[RondaExecution] ⚡ Bypass activo: Recuperando ejecución directamente')
            const exec = await getExecution(assign.executionId)
            if (exec) {
              setExecutionId(exec.id)
              setInitialCompletedIds(exec.completedCheckpoints || [])
              setInitialTrail(exec.gpsTrack || [])
              setPhase('execution')
              setLoading(false)
              return
            }
          }
        }

        // ─── STATE RESTORATION: Direct Firestore query FIRST (anti-ghost) ───
        const execQ = query(
          collection(db, COLLECTIONS.RONDA_EXECUTIONS),
          where('assignmentId', '==', paramId)
        )
        const execSnap = await getDocs(execQ)
        const targetStatuses = [RONDA_STATES.IN_PROGRESS, RONDA_STATES.PAUSED, RONDA_STATES.VALIDATING_VOICE]
        const activeDoc = execSnap.docs.find(d => targetStatuses.includes(d.data().status))

        if (activeDoc) {
          const execData = { id: activeDoc.id, ...activeDoc.data() }
          console.log('[RondaExecution] 🔒 Found live execution via direct query:', activeDoc.id, execData.status)
          setExecutionId(activeDoc.id)

          // Hydrate completed checkpoints from Firestore
          const completed = execData.completedCheckpoints || []
          if (completed.length > 0) {
            setInitialCompletedIds(completed)
            console.log('[RondaExecution] 📋 Restored', completed.length, 'completed checkpoints:', completed)
          }

          // Hydrate GPS trail from Firestore
          const savedTrail = execData.gpsTrack || []
          if (savedTrail.length > 0) {
            setInitialTrail(savedTrail)
            console.log('[RondaExecution] 🗺️ Restored', savedTrail.length, 'trail points')
          }

          if (execData.status === RONDA_STATES.VALIDATING_VOICE) {
            setPhase('voice')
          } else {
            setPhase('execution')
          }
        } else if (assign.executionId) {
          const exec = await getExecution(assign.executionId)
          if (exec) {
            setExecutionId(exec.id)

            if (exec.status === RONDA_STATES.VALIDATING_VOICE) {
              setPhase('voice')
            } else if (
              exec.status === RONDA_STATES.IN_PROGRESS ||
              exec.status === RONDA_STATES.PAUSED
            ) {
              setPhase('execution')
            } else if (
              exec.status === RONDA_STATES.COMPLETED ||
              exec.status === RONDA_STATES.LATE ||
              exec.status === RONDA_STATES.FAILED ||
              exec.status === RONDA_STATES.CANCELLED
            ) {
              setPhase('execution')
            } else {
              setPhase('preop')
            }

            console.log('[RondaExecution] State restored:', exec.status, '→ phase:', phase)
          }
        } else if (
          assign.status === RONDA_STATES.IN_PROGRESS ||
          assign.status === RONDA_STATES.PAUSED
        ) {
          // ─── RESCUE QUERY: assignment is active but executionId is missing (orphaned session) ───
          console.log('[RondaExecution] ⚠️ Active assignment without executionId — running rescue query')
          const rescued = await findActiveExecutionByAssignment(paramId)
          if (rescued) {
            setExecutionId(rescued.id)
            setPhase('execution')
            console.log('[RondaExecution] ✅ Rescued execution:', rescued.id)
          }
        }
      } catch (err) {
        console.error('Error loading execution data:', err)
        setFeedback({ type: 'error', message: 'Error cargando datos de la ronda' })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [paramId])

  // ─── Phase Management ───
  // 'preop' → 'voice' → 'execution'
  const [phase, setPhase] = useState('preop')
  const [executionId, setExecutionId] = useState(null)
  const [preOpData, setPreOpData] = useState(null)

  // ─── Execution Hook (only active in 'execution' phase) ───
  const exec = useRondaExecution({
    assignmentId: paramId,
    rondaId: assignment?.rondaId || '',
    routeId: assignment?.routeId || '',
    guardId: user?.uid || '',
    checkpoints,
    scheduledEnd: assignment?.scheduledEnd || (Date.now() + 2 * 60 * 60 * 1000),
    executionId: phase === 'execution' ? executionId : null,
    initialCompletedIds,
    initialTrail,
  })

  // ─── Pre-Op Modal Confirm ───
  const handlePreOpConfirm = async (data) => {
    setPreOpData(data)

    try {
      // Get position first
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => reject(new Error('GPS requerido')),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        )
      })

      // Create execution in VALIDATING_VOICE state
      const execId = await startExecution({
        assignmentId: paramId,
        rondaId: assignment?.rondaId || '',
        routeId: assignment?.routeId || '',
        guardId: user?.uid || '',
        checkpointIds: checkpoints.map((cp) => cp.id),
        startPosition: pos,
        initialState: RONDA_STATES.VALIDATING_VOICE,
        patrolType: data.patrolType,
        vehicleId: data.vehicleId,
        shift: data.shift,
        voicePassphrase: VOICE_PASSPHRASES[0],
      })

      setExecutionId(execId)
      setPhase('voice')
    } catch (err) {
      setFeedback({ type: 'error', message: err.message })
      setTimeout(() => setFeedback(null), 3000)
    }
  }

  const handlePreOpCancel = () => {
    window.history.back()
  }

  // ─── Voice Validation Success ───
  const handleVoiceSuccess = () => {
    // Voice passed → transition to execution phase
    setPhase('execution')
    // The execution is now IN_PROGRESS in Firestore
    // Start the hook's internal execution
    exec.startWithExecutionId(executionId)
  }

  const handleVoiceFail = () => {
    setFeedback({ type: 'error', message: 'Validación biométrica fallida' })
    setTimeout(() => setFeedback(null), 3000)
  }

  // Auto-center map on guard position once
  useEffect(() => {
    if (phase === 'execution' && exec.position && !hasCentered.current) {
      triggerFlyTo(exec.position.lat, exec.position.lng, 18)
      hasCentered.current = true
    }
  }, [phase, exec.position, triggerFlyTo])

  // ─── Restore GPS tracking after state recovery ───
  const activatedRef = useRef(false)
  useEffect(() => {
    if (phase === 'execution' && executionId && !activatedRef.current) {
      activatedRef.current = true
      exec.startWithExecutionId(executionId)
      console.log('[RondaExecution] GPS tracking activated after restore')
    }
  }, [phase, executionId])

  // ─── Checkpoint Handler ───
  const handleCheckpoint = async () => {
    if (!exec.nextCheckpoint) return

    const result = await exec.registerCheckpointHit(exec.nextCheckpoint.id)

    if (result.success) {
      setFeedback({ type: 'success', message: `✓ ${exec.nextCheckpoint.name} registrado` })
    } else {
      setFeedback({ type: 'error', message: result.validation?.reason || exec.error })
    }

    setTimeout(() => setFeedback(null), 3000)
  }

  const stateColor = STATE_COLORS[exec.status] || '#64748b'
  const gpsClass = exec.accuracy
    ? exec.accuracy <= 15 ? 'ronda-exec__gps-dot--ok'
    : exec.accuracy <= 40 ? 'ronda-exec__gps-dot--warn'
    : 'ronda-exec__gps-dot--bad'
    : ''

  // ─── Render: Loading ───
  if (loading) {
    return (
      <div className="ronda-exec__loading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--color-dark-bg)', color: 'var(--color-dark-text)' }}>
        <span>Cargando datos de la ronda...</span>
      </div>
    )
  }

  // ─── Render: Pre-Op Modal ───
  if (phase === 'preop') {
    return (
      <PreOpModal
        rondaName={route?.name || assignment?.rondaName || 'Ronda Operativa'}
        onConfirm={handlePreOpConfirm}
        onCancel={handlePreOpCancel}
      />
    )
  }

  // ─── Render: Voice Validation Modal ───
  if (phase === 'voice' && executionId) {
    return (
      <VoiceValidationModal
        executionId={executionId}
        passphrase={VOICE_PASSPHRASES[0]}
        guardName={user?.displayName || 'Guardia Operativo'}
        onSuccess={handleVoiceSuccess}
        onFail={handleVoiceFail}
      />
    )
  }

  // ─── Render: Normal Execution UI ───
  return (
    <div className="ronda-exec" id="ronda-execution-page">
      {/* ─── Status Bar ─── */}
      <div className="ronda-exec__status-bar">
        <div className="ronda-exec__status-left">
          <span
            className="ronda-exec__state-dot"
            style={{ background: stateColor, boxShadow: `0 0 8px ${stateColor}` }}
          />
          <span className={`ronda-exec__timer ronda-exec__timer--${exec.timer.urgency}`}>
            {exec.isActive ? exec.timer.elapsedFormatted : STATE_LABELS[exec.status]}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="ronda-exec__progress-text">
            {exec.progress.percentage}%
          </span>
          <div className="ronda-exec__gps">
            <span className={`ronda-exec__gps-dot ${gpsClass}`} />
            {exec.accuracy ? `±${exec.accuracy.toFixed(0)}m` : 'GPS...'}
          </div>
        </div>
      </div>

      {/* ─── Map ─── */}
      <div className="ronda-exec__map">
        <BaseMap
          darkMode
          showControls={false}
          showGpsStatus={false}
          currentExecutionId={executionId}
        >
          <GuardMarker position={exec.position} accuracy={exec.accuracy} name="Tú" />

          <CheckpointLayer
            checkpoints={checkpoints}
            completedIds={exec.validation.completedIds}
            activeId={exec.nextCheckpoint?.id}
          />

          {exec.trail.length > 1 && (
            <TrackingLayer trail={exec.trail} state="tracking" />
          )}
        </BaseMap>
      </div>

      {/* ─── Bottom Panel ─── */}
      <div className="ronda-exec__panel">
        {/* Next checkpoint */}
        {exec.nextCheckpoint && exec.isActive && (
          <div className="ronda-exec__next-cp">
            <div className="ronda-exec__cp-number">
              {exec.nextCheckpoint.order}
            </div>
            <div className="ronda-exec__cp-info">
              <div className="ronda-exec__cp-name">{exec.nextCheckpoint.name}</div>
              <div className="ronda-exec__cp-distance">
                Siguiente checkpoint
              </div>
            </div>
          </div>
        )}

        {/* Validation feedback */}
        {feedback && (
          <div className={`ronda-exec__feedback ronda-exec__feedback--${feedback.type}`}>
            {feedback.message}
          </div>
        )}

        {/* Error */}
        {exec.error && !feedback && (
          <div className="ronda-exec__feedback ronda-exec__feedback--error">
            {exec.error}
          </div>
        )}

        {/* Action buttons */}
        <div className="ronda-exec__actions">
          {!exec.isActive && !exec.isTerminal && (
            <button
              className="ronda-exec__btn ronda-exec__btn--checkpoint"
              onClick={exec.start}
              disabled={exec.isLoading}
            >
              {exec.isLoading ? 'Iniciando...' : '▶ Iniciar Ronda'}
            </button>
          )}

          {exec.isActive && !exec.isPaused && (
            <>
              <button
                className="ronda-exec__btn ronda-exec__btn--checkpoint"
                onClick={handleCheckpoint}
                disabled={!exec.nextCheckpoint || !exec.position}
              >
                📍 Registrar Checkpoint
              </button>
              <button className="ronda-exec__btn ronda-exec__btn--pause" onClick={exec.pause}>
                ⏸
              </button>
            </>
          )}

          {exec.isPaused && (
            <>
              <button
                className="ronda-exec__btn ronda-exec__btn--checkpoint"
                onClick={exec.resume}
              >
                ▶ Reanudar
              </button>
              <button
                className="ronda-exec__btn ronda-exec__btn--cancel"
                onClick={() => exec.cancel('Cancelada por guardia')}
              >
                ✕ Cancelar
              </button>
            </>
          )}

          {exec.isTerminal && (
            <div style={{ textAlign: 'center', width: '100%', color: stateColor, fontWeight: 600 }}>
              {STATE_LABELS[exec.status]}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
