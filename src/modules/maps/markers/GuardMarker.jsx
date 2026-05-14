import { Marker, Popup } from 'react-leaflet'
import { createGuardIcon } from '@/modules/maps/utils/mapIcons'

/**
 * GuardMarker — Renders a guard's position on the map
 * Supports dynamic states: active, tracking, inactive, alert
 * 
 * @param {object} props
 * @param {{ lat: number, lng: number }} props.position
 * @param {string} [props.state='active'] - Guard state
 * @param {string} [props.name] - Guard display name
 * @param {string} [props.guardId]
 * @param {number} [props.accuracy] - GPS accuracy in meters
 * @param {React.ReactNode} [props.children] - Custom popup content
 */
export default function GuardMarker({
  position,
  state = 'active',
  name,
  guardId,
  accuracy,
  children,
}) {
  if (!position) return null

  const icon = createGuardIcon(state)

  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={icon}
      zIndexOffset={1000} // Guards always on top
    >
      <Popup className="sentinel-popup">
        <div style={{ minWidth: 160 }}>
          <strong>{name || guardId || 'Guardia'}</strong>
          <div style={{ fontSize: '0.8em', color: '#888', marginTop: 4 }}>
            Estado: {state}
          </div>
          {accuracy && (
            <div style={{ fontSize: '0.75em', color: '#aaa' }}>
              Precisión: ±{accuracy.toFixed(0)}m
            </div>
          )}
          {children}
        </div>
      </Popup>
    </Marker>
  )
}
