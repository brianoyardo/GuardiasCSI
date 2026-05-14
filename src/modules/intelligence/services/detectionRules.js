import * as turf from '@turf/turf'

const LOG_PREFIX = '[DetectionRules]'

/**
 * Pure functions for Spatial Analytics
 * Designed to be executed in a Web Worker in the future.
 * NO dependencies on DOM, window, or React.
 */

/**
 * Detects if a point has moved less than a threshold distance over a specific time.
 * @param {object} lastState 
 * @param {object} currentPoint 
 * @param {number} currentTime 
 * @returns {object|null} Inactivity alert payload or null
 */
export function detectInactivity(lastState, currentPoint, currentTime) {
  if (!lastState) return null

  const timeDiffMins = (currentTime - lastState.timestamp) / 1000 / 60
  
  if (timeDiffMins > 5) {
    const from = turf.point([lastState.position.lng, lastState.position.lat])
    const to = turf.point([currentPoint.lng, currentPoint.lat])
    const distanceMeters = turf.distance(from, to, { units: 'kilometers' }) * 1000

    if (distanceMeters < 15) {
      return {
        inactiveMinutes: timeDiffMins,
        distanceMovedMeters: distanceMeters,
        reason: 'Guard hasn\'t moved in 5 minutes'
      }
    }
  }
  return null
}

/**
 * Detects if a point implies impossible human speed (e.g. teleporting)
 * @param {object} lastState 
 * @param {object} currentPoint 
 * @param {number} currentTime 
 * @returns {object|null} Speed anomaly payload or null
 */
export function detectSpeedAnomaly(lastState, currentPoint, currentTime) {
  if (!lastState) return null

  const timeDiffMins = (currentTime - lastState.timestamp) / 1000 / 60
  
  if (timeDiffMins > 0) {
    const from = turf.point([lastState.position.lng, lastState.position.lat])
    const to = turf.point([currentPoint.lng, currentPoint.lat])
    const distanceKm = turf.distance(from, to, { units: 'kilometers' })
    const timeDiffHours = timeDiffMins / 60
    const speedKmh = distanceKm / timeDiffHours

    if (speedKmh > 40) {
      return {
        speedKmh,
        reason: 'Impossible Speed'
      }
    }
  }
  return null
}

/**
 * Detects if the current point has an accuracy worse than the allowed threshold.
 * @param {object} currentPoint 
 * @returns {object|null} Accuracy anomaly payload or null
 */
export function detectAccuracyAnomaly(currentPoint) {
  if (currentPoint.accuracy && currentPoint.accuracy > 100) {
    return {
      accuracy: currentPoint.accuracy,
      reason: 'Low Accuracy'
    }
  }
  return null
}
