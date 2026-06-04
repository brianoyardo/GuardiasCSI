import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { STATE_LABELS, STATE_COLORS, canBeStarted, isActiveState } from '@/modules/rondas/stateMachine/rondaStateMachine'
import { getTrueTime, isTimeSynced } from '@/utils/timeSync'
import { updateAssignmentStatus } from '@/modules/rondas/services/rondaAssignmentService'
import './RondaCard.css'

export default function RondaCard({ assignment, completedCheckpoints = 0, totalCheckpoints = 0, hasActiveRonda = false, isVoiceEnrolled = true }) {
  const navigate = useNavigate()
  const { status, scheduledStart, priority, rondaId, routeName, strictTimeSync } = assignment
  const [localNow, setLocalNow] = useState(Date.now())
  const [globalNow, setGlobalNow] = useState(getTrueTime())

  useEffect(() => {
    const timer = setInterval(() => {
      setLocalNow(Date.now())
      setGlobalNow(getTrueTime())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const effectiveNow = strictTimeSync ? globalNow : localNow

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

  const TEN_MINUTES = 10 * 60 * 1000
  const FIVE_MINUTES = 5 * 60 * 1000
  const isTooEarly = canBeStarted(status) && scheduledStart && effectiveNow < (scheduledStart - FIVE_MINUTES)
  const isMissed = canBeStarted(status) && scheduledStart && effectiveNow > (scheduledStart + TEN_MINUTES)
  const isLate = canBeStarted(status) && scheduledStart && effectiveNow > scheduledStart && !isMissed
  const isSyncBlocked = strictTimeSync && !isTimeSynced

  useEffect(() => {
    if (isMissed && (status === 'available' || status === 'pending')) {
      updateAssignmentStatus(assignment.id, 'missed')
    }
  }, [isMissed, status, assignment.id])

  const handleAction = () => {
    navigate(`/guard/ronda/${assignment.id}`, { state: { startedLate: isLate } })
  }

  return (
    <div className={`ronda-card ronda-card--${status}`} id={`ronda-${assignment.id}`}>
      <div className="ronda-card__header">
        <h3 className="ronda-card__title">
          {routeName || `Ronda #${rondaId?.slice(-4) || '—'}`}
        </h3>
        <span
          className="ronda-card__badge"
          style={{ background: `${stateColor}22`, color: stateColor }}
        >
          {stateLabel}
        </span>
      </div>

      <div className="ronda-card__meta">
        {status === 'completed' && assignment.actualStart ? (
          <span className="ronda-card__meta-item">
            ✅ Realizado: {formatTime(assignment.actualStart)} - {formatTime(assignment.actualEnd)}
          </span>
        ) : (
          <span className="ronda-card__meta-item">
            🕐 Inicio: {formatTime(scheduledStart)}
          </span>
        )}
        {isLate && status !== 'completed' && (
          <span className="ronda-card__priority ronda-card__priority--urgent">
            ⚠️ Fuera de horario
          </span>
        )}
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
        {isTimeSynced && (
          <span className="ronda-card__meta-item ronda-card__sync-indicator">
            🌐 Reloj seguro
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
        !isVoiceEnrolled ? (
          <button className="ronda-card__action ronda-card__action--locked" disabled title="Falta enrolamiento de voz">
            🎙️ Voz No Registrada
          </button>
        ) : isSyncBlocked ? (
          <button className="ronda-card__action ronda-card__action--locked" disabled>
            🌐 Sincronizando reloj seguro...
          </button>
        ) : isTooEarly ? (
          <button className="ronda-card__action ronda-card__action--locked" disabled>
            ⏳ Disponible a las {formatTime(scheduledStart - FIVE_MINUTES)}
          </button>
        ) : isMissed ? (
          <button className="ronda-card__action ronda-card__action--locked" disabled title="Ronda vencida">
            🚫 Ronda Vencida (No Cumplida)
          </button>
        ) : hasActiveRonda ? (
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
