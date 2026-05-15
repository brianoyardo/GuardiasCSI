import { useMemo } from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { useRealtimeStore } from '@/stores/realtimeStore'
import { RONDA_STATES, STATE_LABELS } from '@/modules/rondas/stateMachine/rondaStateMachine'
import { PATROL_TYPES, SHIFT_TYPES } from '@/config/constants'
import './LiveGuardMarker.css'

/**
 * SentinelOps — Live Guard Marker (Zero-Render Thrashing)
 * 
 * Architecture:
 *   - Subscribes STRICTLY to a single execution via Zustand selector
 *   - Only re-renders when THIS execution's data changes
 *   - Other guards moving do NOT trigger re-render of this marker
 * 
 * @param {object} props
 * @param {string} props.executionId
 */
export default function LiveGuardMarker({ executionId }) {
  // STRICT selector — only re-renders when this specific execution changes
  const execution = useRealtimeStore(
    (state) => state.activeExecutions[executionId]
  )

  if (!execution || !execution.location) return null

  const { lat, lng } = execution.location
  const status = execution.status || RONDA_STATES.IN_PROGRESS

  const icon = useMemo(() => createTacticalIcon(status), [status])

  const patrolLabel = PATROL_TYPES[execution.patrolType] || execution.patrolType || 'A_PIE'
  const shiftLabel = SHIFT_TYPES[execution.shift] || execution.shift || 'DIURNO'
  const stateLabel = STATE_LABELS[status] || status

  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      zIndexOffset={1000}
    >
      <Popup className="sentinel-popup live-guard-popup">
        <div className="live-guard-popup__content">
          <div className="live-guard-popup__header">
            <span className={`live-guard-popup__status-dot live-guard-popup__status-dot--${status}`} />
            <strong>{execution.guardLabel || execution.guardId || 'Guardia'}</strong>
          </div>

          <div className="live-guard-popup__row">
            <span className="live-guard-popup__label">Estado:</span>
            <span className="live-guard-popup__value">{stateLabel}</span>
          </div>

          <div className="live-guard-popup__row">
            <span className="live-guard-popup__label">Patrullaje:</span>
            <span className="live-guard-popup__value">{patrolLabel.replace('_', ' ')}</span>
          </div>

          <div className="live-guard-popup__row">
            <span className="live-guard-popup__label">Turno:</span>
            <span className="live-guard-popup__value">{shiftLabel.replace('_', ' ')}</span>
          </div>

          {execution.voiceValidated && (
            <div className="live-guard-popup__row live-guard-popup__row--voice">
              <span className="live-guard-popup__label">Voz:</span>
              <span className="live-guard-popup__value live-guard-popup__value--verified">✓ Verificada</span>
            </div>
          )}

          {execution.location.accuracy != null && (
            <div className="live-guard-popup__row">
              <span className="live-guard-popup__label">GPS:</span>
              <span className="live-guard-popup__value">±{execution.location.accuracy.toFixed(0)}m</span>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  )
}

/**
 * Create a tactical Leaflet divIcon based on execution status
 * @param {string} status
 * @returns {L.DivIcon}
 */
function createTacticalIcon(status) {
  let color = '#22c55e' // green (IN_PROGRESS)
  let pulseClass = 'live-guard-marker__pulse'

  if (status === RONDA_STATES.VALIDATING_VOICE) {
    color = '#8b5cf6' // purple (voice validation)
    pulseClass = 'live-guard-marker__pulse live-guard-marker__pulse--voice'
  } else if (status === RONDA_STATES.PAUSED) {
    color = '#f59e0b' // amber (paused)
    pulseClass = 'live-guard-marker__pulse live-guard-marker__pulse--static'
  }

  return L.divIcon({
    className: 'sentinel-marker live-guard-marker',
    html: `
      <div class="live-guard-marker__core" style="background: ${color}"></div>
      <div class="${pulseClass}" style="border-color: ${color}"></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -16],
  })
}
