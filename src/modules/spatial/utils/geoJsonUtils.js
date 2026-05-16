/**
 * SentinelOps — GeoJSON Utilities
 * Enforces strict GeoJSON structure for all spatial entities.
 */

const LOG_PREFIX = '[GeoJsonUtils]'

/**
 * Validates and normalizes a GeoJSON geometry object.
 * @param {object} geometry - The geometry to normalize
 * @param {string} expectedType - 'Point' | 'LineString' | 'Polygon'
 * @returns {object} Valid GeoJSON Geometry
 */
export function normalizeGeometry(geometry, expectedType) {
  if (!geometry || !geometry.type || !geometry.coordinates) {
    throw new Error(`${LOG_PREFIX} Invalid GeoJSON geometry structure.`)
  }

  if (expectedType && geometry.type !== expectedType) {
    throw new Error(`${LOG_PREFIX} Expected ${expectedType}, got ${geometry.type}.`)
  }

  // Deep copy coordinates to ensure clean object
  const cleanCoordinates = JSON.parse(JSON.stringify(geometry.coordinates))

  return {
    type: geometry.type,
    coordinates: cleanCoordinates,
  }
}

/**
 * Sanitize GeoJSON geometry for Firestore storage.
 * Converts nested arrays [[lng, lat]] → flat objects [{lng, lat}]
 * to avoid Firestore "nested arrays not supported" error.
 *
 * @param {object} geometry - GeoJSON geometry from Leaflet/Turf
 * @returns {object} Firestore-safe geometry with coordinatesFirestore
 */
export function sanitizeForFirestore(geometry) {
  if (!geometry || !geometry.type) return geometry

  if (geometry.type === 'LineString') {
    return {
      type: 'LineString',
      coordinatesFirestore: geometry.coordinates.map(c => ({ lng: c[0], lat: c[1] })),
    }
  }

  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates[0]
    return {
      type: 'Polygon',
      coordinatesFirestore: ring.map(c => ({ lng: c[0], lat: c[1] })),
    }
  }

  if (geometry.type === 'Point') {
    return {
      type: 'Point',
      coordinatesFirestore: { lng: geometry.coordinates[0], lat: geometry.coordinates[1] },
    }
  }

  return geometry
}

/**
 * Creates a GeoJSON Feature
 * @param {object} geometry - Valid GeoJSON Geometry
 * @param {object} properties - Custom properties
 * @returns {object} GeoJSON Feature
 */
export function createFeature(geometry, properties = {}) {
  return {
    type: 'Feature',
    geometry: normalizeGeometry(geometry),
    properties,
  }
}

/**
 * Creates a GeoJSON FeatureCollection
 * @param {object[]} features - Array of GeoJSON Features
 * @returns {object} GeoJSON FeatureCollection
 */
export function createFeatureCollection(features = []) {
  return {
    type: 'FeatureCollection',
    features,
  }
}

/**
 * Converts Leaflet LatLng to GeoJSON Point coordinates [lng, lat]
 * @param {{lat: number, lng: number}} latLng
 * @returns {[number, number]}
 */
export function latLngToGeoJsonPoint(latLng) {
  return [latLng.lng, latLng.lat]
}

/**
 * Converts Leaflet LatLng array to GeoJSON LineString coordinates [[lng, lat], ...]
 * @param {Array<{lat: number, lng: number}>} latLngs
 * @returns {Array<[number, number]>}
 */
export function latLngsToGeoJsonLineString(latLngs) {
  return latLngs.map(latLngToGeoJsonPoint)
}

/**
 * Converts Leaflet LatLng nested array to GeoJSON Polygon coordinates [[[lng, lat], ...]]
 * @param {Array<Array<{lat: number, lng: number}>>} latLngs
 * @returns {Array<Array<[number, number]>>}
 */
export function latLngsToGeoJsonPolygon(latLngs) {
  // Leaflet polygon is usually an array of latlng arrays (rings)
  // E.g., [[latlng1, latlng2, ...]]
  // Ensure the polygon is closed
  const rings = latLngs.map(ring => {
    const coords = ring.map(latLngToGeoJsonPoint)
    if (coords.length > 0) {
      const first = coords[0]
      const last = coords[coords.length - 1]
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coords.push([...first]) // Close ring
      }
    }
    return coords
  })
  return rings
}
