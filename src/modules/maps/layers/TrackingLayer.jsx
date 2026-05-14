import { Polyline, CircleMarker } from 'react-leaflet'
import { ROUTE_STYLES, MAP_COLORS } from '@/modules/maps/utils/mapIcons'

/**
 * TrackingLayer — Renders a guard's GPS trail on the map
 * Shows the recorded path with direction indicator
 * 
 * @param {object} props
 * @param {{ lat: number, lng: number, timestamp?: number }[]} props.trail
 * @param {string} [props.state='tracking'] - tracking | completed
 * @param {boolean} [props.showDots=false] - Show individual track points
 */
export default function TrackingLayer({
  trail = [],
  state = 'tracking',
  showDots = false,
}) {
  if (trail.length < 2) return null

  const positions = trail.map((p) => [p.lat, p.lng])
  const pathOptions = ROUTE_STYLES[state] || ROUTE_STYLES.tracking

  return (
    <>
      <Polyline positions={positions} pathOptions={pathOptions} />

      {showDots &&
        trail.map((point, index) => (
          <CircleMarker
            key={index}
            center={[point.lat, point.lng]}
            radius={2}
            pathOptions={{
              color: MAP_COLORS.primary,
              fillColor: MAP_COLORS.primary,
              fillOpacity: 0.6,
              weight: 1,
            }}
          />
        ))}
    </>
  )
}
