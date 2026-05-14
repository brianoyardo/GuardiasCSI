import { Polyline, Popup } from 'react-leaflet'
import { ROUTE_STYLES } from '@/modules/maps/utils/mapIcons'

/**
 * RouteLayer — Renders a route polyline on the map
 * 
 * @param {object} props
 * @param {{ lat: number, lng: number }[]} props.waypoints - Route waypoints
 * @param {string} [props.state='default'] - default | active | completed | tracking
 * @param {string} [props.name]
 * @param {object} [props.styleOverrides] - Override default Leaflet path options
 */
export default function RouteLayer({
  waypoints = [],
  state = 'default',
  name,
  styleOverrides = {},
}) {
  if (waypoints.length < 2) return null

  const positions = waypoints.map((wp) => [
    wp.lat || wp.latitude,
    wp.lng || wp.longitude,
  ])

  const pathOptions = {
    ...(ROUTE_STYLES[state] || ROUTE_STYLES.default),
    ...styleOverrides,
  }

  return (
    <Polyline positions={positions} pathOptions={pathOptions}>
      {name && (
        <Popup className="sentinel-popup">
          <div>
            <strong>🗺 {name}</strong>
            <div style={{ fontSize: '0.8em', color: '#888', marginTop: 4 }}>
              {waypoints.length} puntos • Estado: {state}
            </div>
          </div>
        </Popup>
      )}
    </Polyline>
  )
}
