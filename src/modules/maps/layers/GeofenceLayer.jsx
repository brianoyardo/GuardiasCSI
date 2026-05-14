import { Polygon, Popup } from 'react-leaflet'
import { GEOFENCE_STYLES } from '@/modules/maps/utils/mapIcons'

/**
 * GeofenceLayer — Renders geofence polygons on the map
 * 
 * @param {object} props
 * @param {Array} props.geofences - Array of geofence definitions
 * @param {string[]} [props.activeIds] - Currently active (guard inside) geofence IDs
 * @param {string[]} [props.alertIds] - Geofences in alert state
 * @param {Function} [props.onGeofenceClick]
 */
export default function GeofenceLayer({
  geofences = [],
  activeIds = [],
  alertIds = [],
  onGeofenceClick,
}) {
  if (!geofences.length) return null

  const activeSet = new Set(activeIds)
  const alertSet = new Set(alertIds)

  return (
    <>
      {geofences.map((fence) => {
        const positions = fence.polygon.map((p) => [
          p.lat || p.latitude,
          p.lng || p.longitude,
        ])

        let style = GEOFENCE_STYLES.default
        if (alertSet.has(fence.id)) {
          style = GEOFENCE_STYLES.alert
        } else if (activeSet.has(fence.id)) {
          style = GEOFENCE_STYLES.active
        }

        return (
          <Polygon
            key={fence.id}
            positions={positions}
            pathOptions={style}
            eventHandlers={
              onGeofenceClick ? { click: () => onGeofenceClick(fence) } : {}
            }
          >
            <Popup className="sentinel-popup">
              <div>
                <strong>⬡ {fence.name || 'Geocerca'}</strong>
                {fence.type && (
                  <div style={{ fontSize: '0.8em', color: '#888', marginTop: 4 }}>
                    Tipo: {fence.type}
                  </div>
                )}
                <div style={{ fontSize: '0.75em', marginTop: 4 }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: '0.75em',
                    fontWeight: 600,
                    background: alertSet.has(fence.id) ? '#ef4444' : activeSet.has(fence.id) ? '#22c55e' : '#3380ff',
                    color: 'white',
                  }}>
                    {alertSet.has(fence.id) ? '⚠ Alerta' : activeSet.has(fence.id) ? '● Activa' : '○ Inactiva'}
                  </span>
                </div>
              </div>
            </Popup>
          </Polygon>
        )
      })}
    </>
  )
}
