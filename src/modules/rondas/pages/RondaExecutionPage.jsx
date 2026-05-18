import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS } from '@/config/constants'
import { useAuth } from '@/modules/auth/context/AuthContext'
import { useRondaExecution } from '@/modules/rondas/hooks/useRondaExecution'
import { startExecution, getExecution } from '@/modules/rondas/services/rondaExecutionService'
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
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [feedback, setFeedback] = useState(null)
  const triggerFlyTo = useMapControlStore((s) => s.triggerFlyTo)
  const hasCentered = useRef(false)
  const startedLate = location.state?.startedLate || false

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
          console.error('[RondaExecution] ❌ ASIGNACIÓN NO ENCONTRADA. FUE BORRADA.')
          setFeedback({ type: 'error', message: 'Esta asignación ya no existe en la base de datos.' })
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

        // ─── BLINDAJE DE RESTAURACIÓN DE SESIÓN ───
        let foundExecutionId = assign.executionId
        let execData = null
        const activeStatuses = [RONDA_STATES.IN_PROGRESS, RONDA_STATES.PAUSED, RONDA_STATES.VALIDATING_VOICE]

        // 1. Siempre buscar la verdad absoluta en Firestore (ignorar caché/estado de assign)
        const execQ = query(
          collection(db, COLLECTIONS.RONDA_EXECUTIONS),
          where('assignmentId', '==', paramId)
        )
        const execSnap = await getDocs(execQ)
        console.log('[RondaExecution] 🔍 Buscando ejecuciones para Assignment ID:', paramId)
        console.log('[RondaExecution] 📊 Documentos encontrados:', execSnap.docs.length)
        execSnap.docs.forEach(d => console.log(' -> Exec ID:', d.id, 'Status:', d.data().status))
        const activeDocs = execSnap.docs.filter(d => activeStatuses.includes(d.data().status))

        if (activeDocs.length > 0) {
          // Encontramos una ejecución viva
          const activeDoc = activeDocs[0]
          foundExecutionId = activeDoc.id
          execData = activeDoc.data()
          console.log('[RondaExecution] ⚡ Ejecución activa recuperada por Query:', foundExecutionId)
        } else if (foundExecutionId) {
          // Fallback: Si la query falló pero tenemos ID, buscar directo
          const exec = await getExecution(foundExecutionId)
          if (exec) execData = exec
        }

        // 2. Si tenemos datos de ejecución activa, saltar al mapa INMEDIATAMENTE
        if (execData && activeStatuses.includes(execData.status)) {
          setExecutionId(foundExecutionId)
          setInitialCompletedIds(execData.completedCheckpoints || [])
          setInitialTrail(execData.gpsTrack || [])
          setPhase(execData.status === RONDA_STATES.VALIDATING_VOICE ? 'voice' : 'execution')
          setLoading(false)
          return // NO MOSTRAR EL PRE-OP MODAL
        }
        // ─── FIN DEL BLINDAJE ───
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
        startedLate,
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

  // ─── Redirect to Mis Rondas when completed ───
  useEffect(() => {
    if (exec.status === RONDA_STATES.COMPLETED) {
      console.log('[RondaExecution] ✅ Ronda completed, redirecting to Mis Rondas')
      const timer = setTimeout(() => {
        navigate('/guard/mis-rondas', { replace: true })
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [exec.status, navigate])

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
