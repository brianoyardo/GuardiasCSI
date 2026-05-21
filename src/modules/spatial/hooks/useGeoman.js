import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'

/**
 * Hook to inject Geoman drawing controls into a Leaflet map
 * Phase 18.3: Ensures map dragging stays enabled during drawing
 * Phase 18.4: Anti-MultiClick for checkpoint mode handled at parent level
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

    // Phase 18.3: Prevent self-intersection
    map.pm.setGlobalOptions({
      allowSelfIntersection: false,
    })

    // Event listeners
    map.on('pm:create', (e) => {
      if (onDrawCreated) onDrawCreated(e)
      // Phase 18.3: Re-enable dragging after draw complete
      map.dragging.enable()
    })

    map.on('pm:remove', (e) => {
      if (onDrawDeleted) onDrawDeleted(e)
    })

    // Phase 18.3: Prevent right-click context menu from interfering
    map.on('contextmenu', (e) => {
      e.originalEvent.preventDefault()
    })

    return () => {
      map.pm.removeControls()
      map.off('pm:create')
      map.off('pm:remove')
      map.off('contextmenu')
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

    // Phase 18.3: Force-enable dragging after mode switch
    // Geoman can disable it in some edge cases
    setTimeout(() => {
      map.dragging.enable()
    }, 100)
  }, [mode, map])

  return map
}
