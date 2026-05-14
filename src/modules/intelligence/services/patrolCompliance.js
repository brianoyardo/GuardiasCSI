import * as turf from '@turf/turf'

/**
 * SentinelOps — Patrol Compliance Engine
 * Uses Turf.js to mathematically evaluate spatial adherence of a patrol.
 */

const LOG_PREFIX = '[PatrolCompliance]'

/**
 * Calculate the spatial adherence of a gps track to a predefined route.
 * 
 * @param {Array<{lat: number, lng: number}>} gpsTrack - Real guard movement
 * @param {object} routeGeometry - GeoJSON LineString of the official route
 * @returns {object} { adherencePercentage, deviations, maxDeviationMeters }
 */
export function calculateRouteAdherence(gpsTrack, routeGeometry) {
  if (!gpsTrack || gpsTrack.length < 2) {
    return { adherencePercentage: 0, deviations: [], maxDeviationMeters: 0, error: 'Insufficient GPS data' }
  }

  if (!routeGeometry || routeGeometry.type !== 'LineString') {
    return { adherencePercentage: 0, deviations: [], maxDeviationMeters: 0, error: 'Invalid route geometry' }
  }

  try {
    const routeLine = turf.lineString(routeGeometry.coordinates)
    let totalPoints = gpsTrack.length
    let onTrackPoints = 0
    let maxDev = 0
    let deviations = []

    // Tolerancia en metros para considerar que está "sobre la ruta"
    // (Considerando error estándar de GPS móvil ~10-15m)
    const TOLERANCE_METERS = 25 

    gpsTrack.forEach(point => {
      // Format to Turf Point [lng, lat]
      const pt = turf.point([point.lng, point.lat])
      
      // Calculate shortest distance from point to the LineString
      const distanceKilometers = turf.pointToLineDistance(pt, routeLine)
      const distanceMeters = distanceKilometers * 1000

      if (distanceMeters > maxDev) {
        maxDev = distanceMeters
      }

      if (distanceMeters <= TOLERANCE_METERS) {
        onTrackPoints++
      } else {
        // Log deviation
        deviations.push({
          position: point,
          deviationMeters: distanceMeters,
          timestamp: point.timestamp
        })
      }
    })

    const adherence = (onTrackPoints / totalPoints) * 100

    return {
      adherencePercentage: Number(adherence.toFixed(1)),
      maxDeviationMeters: Number(maxDev.toFixed(1)),
      deviationsCount: deviations.length,
      deviations, // Array of specific deviation points
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Adherence calculation failed:`, error)
    return { adherencePercentage: 0, deviations: [], maxDeviationMeters: 0, error: error.message }
  }
}

/**
 * Validates if the entire track is contained within a designated Geofence.
 * @param {Array<{lat: number, lng: number}>} gpsTrack 
 * @param {object} geofenceGeometry - GeoJSON Polygon
 */
export function validateGeofenceAdherence(gpsTrack, geofenceGeometry) {
  if (!gpsTrack || !geofenceGeometry || geofenceGeometry.type !== 'Polygon') return null

  try {
    const polygon = turf.polygon(geofenceGeometry.coordinates)
    const violations = []

    gpsTrack.forEach(point => {
      const pt = turf.point([point.lng, point.lat])
      const isInside = turf.booleanPointInPolygon(pt, polygon)
      if (!isInside) {
        violations.push({ position: point, timestamp: point.timestamp })
      }
    })

    return {
      violationsCount: violations.length,
      violations,
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} Geofence validation failed:`, err)
    return null
  }
}
