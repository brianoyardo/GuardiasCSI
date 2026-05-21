import { useMemo } from 'react'
import { BaseMap, RouteLayer } from '@/modules/maps'
import { Polyline, Marker as LeafletMarker } from 'react-leaflet'
import L from 'leaflet'

/**
 * SentinelOps — PlaybackMap
 * Phase 21: Renders blue progressive trail + pulsing blue dot at currentIndex
 * 
 * @param {Array<{lat, lng, timestamp}>} props.track - Array of GPS points
 * @param {object} [props.routeGeometry] - Official route GeoJSON
 * @param {number} props.currentIndex - Current playback index
 */

const TRAIL_COLOR = '#3b82f6'

function createPlaybackDotIcon() {
  return L.divIcon({
    className: 'playback-dot-icon',
    html: `
      <div class="playback-dot">
        <div class="playback-dot__core"></div>
        <div class="playback-dot__pulse"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

const playbackDot = createPlaybackDotIcon()

export default function PlaybackMap({ track = [], routeGeometry, currentIndex = 0 }) {
  if (!track || track.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-dark-surface, #1a1a2e)' }}>
        <span style={{ color: 'var(--color-dark-text-muted, #888)' }}>No hay datos de tracking para reproducir</span>
      </div>
    )
  }

  // Current position
  const currentPoint = useMemo(() => {
    const idx = Math.min(Math.max(0, currentIndex), track.length - 1)
    return track[idx]
  }, [track, currentIndex])

  // Trail from 0 to currentIndex as Leaflet positions
  const trailPositions = useMemo(() => {
    const idx = Math.min(Math.max(0, currentIndex), track.length - 1)
    return track.slice(0, idx + 1)
      .map(p => [p.lat || p.latitude, p.lng || p.longitude])
      .filter(c => c[0] && c[1])
  }, [track, currentIndex])

  // Official route waypoints
  const waypoints = useMemo(() => {
    if (!routeGeometry) return []
    return routeGeometry.coordinates.map(c => ({ lng: c[0], lat: c[1] }))
  }, [routeGeometry])

  // Center position for BaseMap
  const center = useMemo(() => {
    if (!currentPoint) return undefined
    return { lat: currentPoint.lat || currentPoint.latitude, lng: currentPoint.lng || currentPoint.longitude }
  }, [currentPoint])

  const dotPosition = center ? [center.lat, center.lng] : null

  return (
    <BaseMap 
      center={center} 
      zoom={16} 
      darkMode={true}
      showControls={false}
    >
      {/* Official Route (Background — muted) */}
      {routeGeometry && (
        <RouteLayer 
          waypoints={waypoints} 
          state="default"
          styleOverrides={{ opacity: 0.3 }}
        />
      )}

      {/* Blue Progressive Trail */}
      {trailPositions.length >= 2 && (
        <Polyline
          positions={trailPositions}
          pathOptions={{
            color: TRAIL_COLOR,
            weight: 4,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      )}

      {/* Current Position — Blue pulsing dot */}
      {dotPosition && (
        <LeafletMarker
          position={dotPosition}
          icon={playbackDot}
        />
      )}
    </BaseMap>
  )
}
