import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import './IncidentMarker.css'

const SEVERITY_CONFIG = {
  critical: { color: '#ef4444', label: 'Cr\xEDtico' },
  high: { color: '#ef4444', label: 'Alta' },
  medium: { color: '#f59e0b', label: 'Media' },
  low: { color: '#eab308', label: 'Baja' },
}

function createIncidentIcon(severity) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.low

  return L.divIcon({
    className: '',
    html: `
      <div class="incident-marker">
        <div class="incident-marker__pulse" style="background: ${cfg.color}"></div>
        <div class="incident-marker__core" style="background: ${cfg.color}"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
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
