import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'

/**
 * Hook to inject Geoman drawing controls into a Leaflet map
 */
export function useGeoman({ 
  onDrawCreated, 
  onDrawEdited, 
  onDrawDeleted,
  mode = 'view' // view | draw_route | draw_geofence | draw_checkpoint
}) {
  const map = useMap()

  useEffect(() => {
    if (!map) return

    // Initialize Geoman globally for the map
    map.pm.addControls({
      position: 'topleft',
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawPolygon: false,
      drawCircle: false,
      drawText: false,
      editMode: true,
      dragMode: true,
      cutPolygon: false,
      removalMode: true,
    })

    // Setup tactical colors for drawing
    map.pm.setPathOptions({
      color: '#3b82f6',
      weight: 3,
      fillColor: '#3b82f6',
      fillOpacity: 0.2,
    })

    // Event listeners
    map.on('pm:create', (e) => {
      if (onDrawCreated) onDrawCreated(e)
    })

    map.on('pm:remove', (e) => {
      if (onDrawDeleted) onDrawDeleted(e)
    })

    return () => {
      map.pm.removeControls()
      map.off('pm:create')
      map.off('pm:remove')
    }
  }, [map, onDrawCreated, onDrawDeleted])

  // React to mode changes by enabling specific drawing tools programmatically
  useEffect(() => {
    if (!map) return

    // Disable all first
    map.pm.disableDraw()

    if (mode === 'draw_route') {
      map.pm.enableDraw('Line', {
        snappable: true,
        snapDistance: 20,
        pathOptions: { color: '#8b5cf6', weight: 4 } // Purple for routes
      })
    } else if (mode === 'draw_geofence') {
      map.pm.enableDraw('Polygon', {
        snappable: true,
        snapDistance: 20,
        pathOptions: { color: '#ef4444', weight: 2, fillColor: '#ef4444', fillOpacity: 0.3 } // Red for geofences
      })
    } else if (mode === 'draw_checkpoint') {
      map.pm.enableDraw('Marker', {
        snappable: true,
        snapDistance: 20,
      })
    }
  }, [mode, map])

  return map
}
