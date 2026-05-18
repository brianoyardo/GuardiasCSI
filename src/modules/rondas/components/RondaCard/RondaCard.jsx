import { useNavigate } from 'react-router-dom'
import { STATE_LABELS, STATE_COLORS, canBeStarted, isActiveState } from '@/modules/rondas/stateMachine/rondaStateMachine'
import './RondaCard.css'

/**
 * RondaCard — Mobile-first ronda assignment card
 * Shows: status, schedule, progress, action button
 * 
 * @param {object} props
 * @param {object} props.assignment
 * @param {number} [props.completedCheckpoints]
 * @param {number} [props.totalCheckpoints]
 */
export default function RondaCard({ assignment, completedCheckpoints = 0, totalCheckpoints = 0, hasActiveRonda = false }) {
  const navigate = useNavigate()
  const { status, scheduledStart, scheduledEnd, priority, rondaId, executionId } = assignment

  const stateLabel = STATE_LABELS[status] || status
  const stateColor = STATE_COLORS[status] || '#64748b'

  const progressPct = totalCheckpoints > 0
    ? Math.round((completedCheckpoints / totalCheckpoints) * 100)
    : 0

  const formatTime = (ts) => {
    if (!ts) return '--:--'
    const d = new Date(typeof ts === 'number' ? ts : ts?.toMillis?.() || ts)
    return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
  }

  const handleAction = () => {
    if (canBeStarted(status)) {
      navigate(`/guard/ronda/${assignment.id}`)
    } else if (isActiveState(status) && executionId) {
      navigate(`/guard/ronda/${executionId}`)
    }
  }

  return (
    <div className={`ronda-card ronda-card--${status}`} id={`ronda-${assignment.id}`}>
      <div className="ronda-card__header">
        <h3 className="ronda-card__title">
          Ronda #{rondaId?.slice(-4) || '—'}
        </h3>
        <span
          className="ronda-card__badge"
          style={{ background: `${stateColor}22`, color: stateColor }}
        >
          {stateLabel}
        </span>
      </div>

      <div className="ronda-card__meta">
        <span className="ronda-card__meta-item">
          🕐 {formatTime(scheduledStart)} - {formatTime(scheduledEnd)}
        </span>
        {totalCheckpoints > 0 && (
          <span className="ronda-card__meta-item">
            📍 {completedCheckpoints}/{totalCheckpoints} checkpoints
          </span>
        )}
        {priority && priority !== 'normal' && (
          <span className={`ronda-card__priority ronda-card__priority--${priority}`}>
            {priority === 'urgent' ? '🔴 URGENTE' : priority === 'high' ? '🟠 ALTA' : ''}
          </span>
        )}
      </div>

      {isActiveState(status) && totalCheckpoints > 0 && (
        <div className="ronda-card__progress">
          <div
            className="ronda-card__progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {canBeStarted(status) && (
        hasActiveRonda ? (
          <button className="ronda-card__action ronda-card__action--locked" disabled title="Ya tienes una ronda en curso">
            🔒 Ya tienes una ronda en curso
          </button>
        ) : (
          <button className="ronda-card__action ronda-card__action--start" onClick={handleAction}>
            ▶ Iniciar Ronda
          </button>
        )
      )}

      {(status === 'paused' || status === 'in_progress') && (
        <button className="ronda-card__action ronda-card__action--resume" onClick={handleAction}>
          ▶ Continuar Ronda
        </button>
      )}
    </div>
  )
}
