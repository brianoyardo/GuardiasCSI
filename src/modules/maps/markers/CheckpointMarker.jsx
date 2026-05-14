import { Marker, Popup } from 'react-leaflet'
import { createCheckpointIcon } from '@/modules/maps/utils/mapIcons'

/**
 * CheckpointMarker — Renders a checkpoint on the map
 * Supports states: pending, active, completed, missed
 * 
 * @param {object} props
 * @param {{ lat: number, lng: number }} props.position
 * @param {string} [props.state='pending']
 * @param {number|string} [props.order] - Checkpoint order number
 * @param {string} [props.name]
 * @param {string} [props.description]
 * @param {Function} [props.onClick]
 * @param {React.ReactNode} [props.children] - Custom popup content
 */
export default function CheckpointMarker({
  position,
  state = 'pending',
  order = '',
  name,
  description,
  onClick,
  children,
}) {
  if (!position) return null

  const icon = createCheckpointIcon(state, String(order))

  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={icon}
      eventHandlers={onClick ? { click: onClick } : {}}
    >
      <Popup className="sentinel-popup">
        <div style={{ minWidth: 140 }}>
          <strong>{name || `Checkpoint ${order}`}</strong>
          {description && (
            <div style={{ fontSize: '0.8em', color: '#888', marginTop: 4 }}>
              {description}
            </div>
          )}
          <div style={{ fontSize: '0.75em', marginTop: 4 }}>
            <span style={{
              display: 'inline-block',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: '0.75em',
              fontWeight: 600,
              background: state === 'completed' ? '#16a34a' : state === 'missed' ? '#ef4444' : '#f59e0b',
              color: 'white',
            }}>
              {state === 'completed' ? '✓ Completado' :
               state === 'active' ? '● Activo' :
               state === 'missed' ? '✗ Omitido' : '○ Pendiente'}
            </span>
          </div>
          {children}
        </div>
      </Popup>
    </Marker>
  )
}
