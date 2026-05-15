import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/modules/auth/context/AuthContext'
import { useRondaExecution } from '@/modules/rondas/hooks/useRondaExecution'
import { startExecution } from '@/modules/rondas/services/rondaExecutionService'
import { STATE_LABELS, STATE_COLORS, RONDA_STATES } from '@/modules/rondas/stateMachine/rondaStateMachine'
import { BaseMap, CheckpointLayer, TrackingLayer, GuardMarker } from '@/modules/maps'
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

// Mock checkpoints for development (will be replaced by Firestore data)
const MOCK_CHECKPOINTS = [
  { id: 'cp1', name: 'Entrada Principal', lat: -16.4990, lng: -68.1490, order: 1 },
  { id: 'cp2', name: 'Estacionamiento', lat: -16.4995, lng: -68.1495, order: 2 },
  { id: 'cp3', name: 'Bodega', lat: -16.5000, lng: -68.1500, order: 3 },
  { id: 'cp4', name: 'Perímetro Norte', lat: -16.4985, lng: -68.1505, order: 4 },
]

export default function RondaExecutionPage() {
  const { executionId: paramId } = useParams()
  const { user } = useAuth()
  const [feedback, setFeedback] = useState(null)

  // ─── Phase Management ───
  // 'preop' → 'voice' → 'execution'
  const [phase, setPhase] = useState('preop')
  const [executionId, setExecutionId] = useState(null)
  const [preOpData, setPreOpData] = useState(null)

  // ─── Execution Hook (only active in 'execution' phase) ───
  const exec = useRondaExecution({
    assignmentId: paramId,
    rondaId: 'ronda-demo',
    routeId: 'route-demo',
    guardId: user?.uid || '',
    checkpoints: MOCK_CHECKPOINTS,
    scheduledEnd: Date.now() + 2 * 60 * 60 * 1000,
    executionId: phase === 'execution' ? executionId : null,
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
          { enableHighAccuracy: true, timeout: 10000 }
        )
      })

      // Create execution in VALIDATING_VOICE state
      const execId = await startExecution({
        assignmentId: paramId,
        rondaId: 'ronda-demo',
        routeId: 'route-demo',
        guardId: user?.uid || '',
        checkpointIds: MOCK_CHECKPOINTS.map((cp) => cp.id),
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

  // ─── Render: Pre-Op Modal ───
  if (phase === 'preop') {
    return (
      <PreOpModal
        rondaName="Patrullaje Diurno"
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
        >
          <CheckpointLayer
            checkpoints={MOCK_CHECKPOINTS}
            completedIds={exec.validation.completedIds}
            activeId={exec.nextCheckpoint?.id}
          />

          {exec.trail.length > 1 && (
            <TrackingLayer trail={exec.trail} state="tracking" />
          )}

          {exec.position && (
            <GuardMarker
              position={exec.position}
              state={exec.isActive ? 'tracking' : 'inactive'}
              name="Tu posición"
              accuracy={exec.accuracy}
            />
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
