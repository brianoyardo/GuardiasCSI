import { useMemo } from 'react'
import { BaseMap, GuardMarker, RouteLayer } from '@/modules/maps'

/**
 * SentinelOps — PlaybackMap
 * Tactical auditing tool. Animates historical GPS tracks over the base map.
 * Pure renderer component.
 * 
 * @param {object} props
 * @param {Array<{lat, lng, timestamp}>} props.track - Array of GPS points
 * @param {object} [props.routeGeometry] - Official route GeoJSON
 * @param {number} props.currentIndex - Current playback index
 */
export default function PlaybackMap({ track = [], routeGeometry, currentIndex = 0 }) {
  if (!track || track.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-dark-surface)' }}>
        <span style={{ color: 'var(--color-dark-text-muted)' }}>No hay datos de tracking para reproducir</span>
      </div>
    )
  }

  // Memoize derived calculations to avoid unnecessary re-computations
  const currentPoint = useMemo(() => {
    const idx = Math.min(Math.max(0, currentIndex), track.length - 1)
    return track[idx]
  }, [track, currentIndex])

  const historicalTrail = useMemo(() => {
    const idx = Math.min(Math.max(0, currentIndex), track.length - 1)
    return track.slice(0, idx + 1)
  }, [track, currentIndex])

  const waypoints = useMemo(() => {
    if (!routeGeometry) return []
    return routeGeometry.coordinates.map(c => ({ lng: c[0], lat: c[1] }))
  }, [routeGeometry])

  return (
    <BaseMap 
      center={currentPoint} 
      zoom={16} 
      darkMode={true}
      showControls={false}
    >
      {/* Official Route (Background) */}
      {routeGeometry && (
        <RouteLayer 
          waypoints={waypoints} 
          state="default"
          styleOverrides={{ opacity: 0.3 }}
        />
      )}

      {/* Guard's Actual Path Taken */}
      <RouteLayer 
        waypoints={historicalTrail} 
        state="tracking" 
      />

      {/* Current Position Marker */}
      <GuardMarker 
        guard={{ 
          id: 'playback', 
          position: currentPoint, 
          status: 'active' 
        }} 
      />
    </BaseMap>
  )
}
