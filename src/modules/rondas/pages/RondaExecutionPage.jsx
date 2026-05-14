import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/modules/auth/context/AuthContext'
import { useRondaExecution } from '@/modules/rondas/hooks/useRondaExecution'
import { STATE_LABELS, STATE_COLORS, RONDA_STATES } from '@/modules/rondas/stateMachine/rondaStateMachine'
import { BaseMap, CheckpointLayer, TrackingLayer, GuardMarker } from '@/modules/maps'
import './RondaExecutionPage.css'

/**
 * RondaExecutionPage — Mobile tactical execution center
 * 
 * Layout: Status Bar → Map → Bottom Panel
 * The guard operates the ronda entirely from this screen.
 * 
 * NOTE: In a real scenario, assignment/ronda data would be fetched
 * from Firestore via the executionId param. For now, this uses mock data
 * to demonstrate the UI and hook composition.
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

  // In production, these would come from Firestore
  const exec = useRondaExecution({
    assignmentId: paramId,
    rondaId: 'ronda-demo',
    routeId: 'route-demo',
    guardId: user?.uid || '',
    checkpoints: MOCK_CHECKPOINTS,
    scheduledEnd: Date.now() + 2 * 60 * 60 * 1000, // 2 hours from now
  })

  const handleCheckpoint = async () => {
    if (!exec.nextCheckpoint) return

    const result = await exec.registerCheckpointHit(exec.nextCheckpoint.id)

    if (result.success) {
      setFeedback({ type: 'success', message: `✓ ${exec.nextCheckpoint.name} registrado` })
    } else {
      setFeedback({ type: 'error', message: result.validation?.reason || exec.error })
    }

    // Clear feedback after 3s
    setTimeout(() => setFeedback(null), 3000)
  }

  const stateColor = STATE_COLORS[exec.status] || '#64748b'
  const gpsClass = exec.accuracy
    ? exec.accuracy <= 15 ? 'ronda-exec__gps-dot--ok'
    : exec.accuracy <= 40 ? 'ronda-exec__gps-dot--warn'
    : 'ronda-exec__gps-dot--bad'
    : ''

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
