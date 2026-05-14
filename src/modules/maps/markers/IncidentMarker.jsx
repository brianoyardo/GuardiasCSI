import { Marker, Popup } from 'react-leaflet'
import { createIncidentIcon } from '@/modules/maps/utils/mapIcons'

/**
 * IncidentMarker — Renders an incident on the map
 * 
 * @param {object} props
 * @param {{ lat: number, lng: number }} props.position
 * @param {string} [props.severity='medium'] - low | medium | high | critical
 * @param {string} [props.title]
 * @param {string} [props.description]
 * @param {string} [props.type]
 * @param {string} [props.timestamp]
 * @param {React.ReactNode} [props.children]
 */
export default function IncidentMarker({
  position,
  severity = 'medium',
  title,
  description,
  type,
  timestamp,
  children,
}) {
  if (!position) return null

  const icon = createIncidentIcon(severity)

  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={icon}
      zIndexOffset={500}
    >
      <Popup className="sentinel-popup">
        <div style={{ minWidth: 160 }}>
          <strong style={{ color: severity === 'critical' ? '#dc2626' : '#f97316' }}>
            ⚠ {title || 'Incidente'}
          </strong>
          {type && (
            <div style={{ fontSize: '0.8em', color: '#888', marginTop: 2 }}>
              Tipo: {type}
            </div>
          )}
          {description && (
            <div style={{ fontSize: '0.8em', color: '#aaa', marginTop: 4 }}>
              {description}
            </div>
          )}
          {timestamp && (
            <div style={{ fontSize: '0.7em', color: '#666', marginTop: 4 }}>
              {new Date(timestamp).toLocaleString('es-BO')}
            </div>
          )}
          <div style={{
            display: 'inline-block',
            marginTop: 6,
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: '0.7em',
            fontWeight: 700,
            textTransform: 'uppercase',
            background: severity === 'critical' ? '#dc2626' : severity === 'high' ? '#ef4444' : severity === 'medium' ? '#f97316' : '#f59e0b',
            color: 'white',
          }}>
            {severity}
          </div>
          {children}
        </div>
      </Popup>
    </Marker>
  )
}
