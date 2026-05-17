import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { renderToString } from 'react-dom/server'
import { FaExclamationTriangle, FaExclamationCircle, FaInfoCircle, FaRadiation } from 'react-icons/fa'
import './IncidentMarker.css'

const SEVERITY_CONFIG = {
  critical: { color: '#ef4444', label: 'Cr\xEDtico', Icon: FaRadiation },
  high: { color: '#f97316', label: 'Alta', Icon: FaExclamationTriangle },
  medium: { color: '#22c55e', label: 'Media', Icon: FaExclamationCircle },
  low: { color: '#3b82f6', label: 'Baja', Icon: FaInfoCircle },
}

function createIncidentIcon(severity) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.low
  const { Icon } = cfg
  const iconSvg = renderToString(<Icon color={cfg.color} size={20} />)

  const isCritical = severity === 'critical'

  return L.divIcon({
    className: '',
    html: isCritical
      ? `
      <div class="incident-marker">
        <div class="incident-marker__pulse" style="background: ${cfg.color}"></div>
        <div class="incident-marker__core incident-marker__core--critical">
          ${iconSvg}
        </div>
      </div>
    `
      : `
      <div class="incident-marker incident-marker--static">
        <div class="incident-marker__core incident-marker__core--icon">
          ${iconSvg}
        </div>
      </div>
    `,
    iconSize: isCritical ? [32, 32] : [28, 28],
    iconAnchor: isCritical ? [16, 16] : [14, 14],
    popupAnchor: [0, isCritical ? -16 : -14],
  })
}

export default function IncidentMarker({ incident }) {
  if (!incident.location || !incident.location.lat) return null

  const cfg = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.low

  return (
    <Marker
      position={[incident.location.lat, incident.location.lng]}
      icon={createIncidentIcon(incident.severity)}
    >
      <Popup className="incident-popup" closeButton={false}>
        <div className="incident-popup__card">
          <div className="incident-popup__header">
            <span
              className="incident-popup__severity-dot"
              style={{ background: cfg.color }}
            />
            <span className="incident-popup__type">{incident.type}</span>
          </div>

          <div className="incident-popup__severity">
            Severidad: <strong style={{ color: cfg.color }}>{cfg.label}</strong>
          </div>

          {incident.description && (
            <p className="incident-popup__description">{incident.description}</p>
          )}

          {incident.evidenceIds?.length > 0 && (
            <div className="incident-popup__evidence">
              &#x1F4F7; Evidencia adjunta ({incident.evidenceIds.length})
            </div>
          )}

          <div className="incident-popup__footer">
            <span className="incident-popup__status">{incident.status}</span>
          </div>
        </div>
      </Popup>
    </Marker>
  )
}
