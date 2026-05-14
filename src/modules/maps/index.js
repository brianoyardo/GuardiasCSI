/**
 * SentinelOps — Maps Module Public API
 * 
 * Architecture:
 *   components/    → BaseMap, composable map containers
 *   hooks/         → useGeolocation, useGeofence, useMapTracking, useRealtimeLocation
 *   layers/        → CheckpointLayer, RouteLayer, GeofenceLayer, TrackingLayer
 *   markers/       → GuardMarker, CheckpointMarker, IncidentMarker
 *   services/      → layerManager, trackingService
 *   utils/         → geoUtils (Haversine, GeoJSON, spatial), mapIcons (SVG tactical icons)
 */

// ─── Components ───
export { default as BaseMap } from './components/BaseMap/BaseMap'

// ─── Hooks ───
export {
  useGeolocation,
  useGeofence,
  useMapTracking,
  useRealtimeLocation,
  useMultiGuardTracking,
} from './hooks'

// ─── Layers ───
export { default as CheckpointLayer } from './layers/CheckpointLayer'
export { default as RouteLayer } from './layers/RouteLayer'
export { default as GeofenceLayer } from './layers/GeofenceLayer'
export { default as TrackingLayer } from './layers/TrackingLayer'

// ─── Markers ───
export { default as GuardMarker } from './markers/GuardMarker'
export { default as CheckpointMarker } from './markers/CheckpointMarker'
export { default as IncidentMarker } from './markers/IncidentMarker'

// ─── Services ───
export { useLayerManager, MAP_LAYERS } from './services/layerManager'
export {
  updateLivePosition,
  appendTrackPoint,
  batchUploadTrail,
  clearLivePosition,
} from './services/trackingService'

// ─── Utils ───
export {
  haversineDistance,
  isWithinRadius,
  createPoint,
  createLineString,
  createPolygon,
  createFeatureCollection,
  isPointInPolygon,
  polygonCentroid,
  routeDistance,
  findNearestPoint,
  toLatLng,
  fromLatLng,
  isValidCoordinate,
  calculateBearing,
  getBounds,
  toLeafletBounds,
} from './utils/geoUtils'

export {
  createGuardIcon,
  createCheckpointIcon,
  createIncidentIcon,
  GEOFENCE_STYLES,
  ROUTE_STYLES,
  MAP_COLORS,
} from './utils/mapIcons'
