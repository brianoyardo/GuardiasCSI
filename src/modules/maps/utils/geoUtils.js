/**
 * SentinelOps — GeoJSON & Spatial Utilities
 * Foundation for all geospatial operations
 * 
 * Supports: Point, Polygon, LineString, distance, containment, validation
 * Prepared for: geocercas, tracking, route analysis, spatial queries
 */

const EARTH_RADIUS_METERS = 6371e3

/**
 * ─── DISTANCE ───────────────────────────────
 */

/**
 * Haversine distance between two coordinates
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} Distance in meters
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Check if a point is within a given radius of another point
 * @param {{ lat: number, lng: number }} point
 * @param {{ lat: number, lng: number }} center
 * @param {number} radiusMeters
 * @returns {boolean}
 */
export function isWithinRadius(point, center, radiusMeters) {
  const dist = haversineDistance(point.lat, point.lng, center.lat, center.lng)
  return dist <= radiusMeters
}

/**
 * ─── GeoJSON FACTORIES ──────────────────────
 */

/**
 * Create a GeoJSON Point
 * @param {number} lat
 * @param {number} lng
 * @param {object} [properties]
 * @returns {object} GeoJSON Feature
 */
export function createPoint(lat, lng, properties = {}) {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [lng, lat], // GeoJSON uses [lng, lat]
    },
    properties,
  }
}

/**
 * Create a GeoJSON LineString from an array of coordinates
 * @param {{ lat: number, lng: number }[]} coords
 * @param {object} [properties]
 * @returns {object} GeoJSON Feature
 */
export function createLineString(coords, properties = {}) {
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: coords.map((c) => [c.lng, c.lat]),
    },
    properties,
  }
}

/**
 * Create a GeoJSON Polygon from an array of coordinates
 * Automatically closes the ring if not already closed
 * @param {{ lat: number, lng: number }[]} coords
 * @param {object} [properties]
 * @returns {object} GeoJSON Feature
 */
export function createPolygon(coords, properties = {}) {
  const ring = coords.map((c) => [c.lng, c.lat])

  // Close ring if not already closed
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([...first])
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [ring],
    },
    properties,
  }
}

/**
 * Create a GeoJSON FeatureCollection
 * @param {object[]} features - Array of GeoJSON Features
 * @returns {object}
 */
export function createFeatureCollection(features = []) {
  return {
    type: 'FeatureCollection',
    features,
  }
}

/**
 * ─── POLYGON / GEOFENCE OPERATIONS ─────────
 */

/**
 * Ray-casting algorithm: check if a point is inside a polygon
 * @param {{ lat: number, lng: number }} point
 * @param {{ lat: number, lng: number }[]} polygon - Array of vertices
 * @returns {boolean}
 */
export function isPointInPolygon(point, polygon) {
  const x = point.lng
  const y = point.lat
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng
    const yi = polygon[i].lat
    const xj = polygon[j].lng
    const yj = polygon[j].lat

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi

    if (intersect) inside = !inside
  }

  return inside
}

/**
 * Calculate the centroid of a polygon
 * @param {{ lat: number, lng: number }[]} polygon
 * @returns {{ lat: number, lng: number }}
 */
export function polygonCentroid(polygon) {
  const n = polygon.length
  const sum = polygon.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 }
  )
  return { lat: sum.lat / n, lng: sum.lng / n }
}

/**
 * ─── ROUTE / LINESTRING OPERATIONS ─────────
 */

/**
 * Calculate total distance of a route (array of points)
 * @param {{ lat: number, lng: number }[]} route
 * @returns {number} Total distance in meters
 */
export function routeDistance(route) {
  let total = 0
  for (let i = 1; i < route.length; i++) {
    total += haversineDistance(
      route[i - 1].lat, route[i - 1].lng,
      route[i].lat, route[i].lng
    )
  }
  return total
}

/**
 * Find the nearest point in an array to a reference point
 * @param {{ lat: number, lng: number }} ref
 * @param {{ lat: number, lng: number, id?: string }[]} points
 * @returns {{ point: object, distance: number, index: number } | null}
 */
export function findNearestPoint(ref, points) {
  if (!points.length) return null

  let nearest = null
  let minDist = Infinity

  points.forEach((p, index) => {
    const dist = haversineDistance(ref.lat, ref.lng, p.lat, p.lng)
    if (dist < minDist) {
      minDist = dist
      nearest = { point: p, distance: dist, index }
    }
  })

  return nearest
}

/**
 * ─── COORDINATE UTILITIES ──────────────────
 */

/**
 * Convert Firestore coordinate object to Leaflet-compatible [lat, lng]
 * @param {{ lat: number, lng: number } | { latitude: number, longitude: number }} coord
 * @returns {[number, number]} [lat, lng]
 */
export function toLatLng(coord) {
  if (coord.lat !== undefined) return [coord.lat, coord.lng]
  if (coord.latitude !== undefined) return [coord.latitude, coord.longitude]
  return [0, 0]
}

/**
 * Convert Leaflet [lat, lng] to object
 * @param {[number, number]} arr
 * @returns {{ lat: number, lng: number }}
 */
export function fromLatLng(arr) {
  return { lat: arr[0], lng: arr[1] }
}

/**
 * Validate coordinate values
 * @param {number} lat
 * @param {number} lng
 * @returns {boolean}
 */
export function isValidCoordinate(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !isNaN(lat) && !isNaN(lng)
  )
}

/**
 * ─── BEARING & HEADING ─────────────────────
 */

/**
 * Calculate bearing between two points (for rotation/heading icons)
 * @param {{ lat: number, lng: number }} from
 * @param {{ lat: number, lng: number }} to
 * @returns {number} Bearing in degrees (0-360)
 */
export function calculateBearing(from, to) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const toDeg = (rad) => (rad * 180) / Math.PI

  const dLng = toRad(to.lng - from.lng)
  const lat1 = toRad(from.lat)
  const lat2 = toRad(to.lat)

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)

  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

/**
 * ─── BOUNDS ────────────────────────────────
 */

/**
 * Calculate bounding box for an array of points
 * @param {{ lat: number, lng: number }[]} points
 * @returns {{ north: number, south: number, east: number, west: number } | null}
 */
export function getBounds(points) {
  if (!points.length) return null

  let north = -Infinity
  let south = Infinity
  let east = -Infinity
  let west = Infinity

  for (const p of points) {
    if (p.lat > north) north = p.lat
    if (p.lat < south) south = p.lat
    if (p.lng > east) east = p.lng
    if (p.lng < west) west = p.lng
  }

  return { north, south, east, west }
}

/**
 * Convert bounds to Leaflet LatLngBounds format
 * @param {{ north: number, south: number, east: number, west: number }} bounds
 * @returns {[[number, number], [number, number]]}
 */
export function toLeafletBounds(bounds) {
  return [
    [bounds.south, bounds.west],
    [bounds.north, bounds.east],
  ]
}
