/**
 * SentinelOps — Ronda Validators
 * GPS validation, checkpoint validation, temporal validation
 * 
 * These validators are pure functions — no side effects.
 * They validate operational rules and return results.
 * 
 * Prepared for: spoofing detection, anomaly detection, scoring
 */

import { haversineDistance, isWithinRadius, isPointInPolygon } from '@/modules/maps/utils/geoUtils'
import { MAX_CHECKPOINT_DISTANCE_METERS } from '@/config/constants'

// ─── Checkpoint Validation ───

/**
 * Validate if a guard is close enough to register a checkpoint
 * @param {{ lat: number, lng: number }} guardPosition
 * @param {{ lat: number, lng: number }} checkpointPosition
 * @param {number} [maxDistance] - Override default max distance
 * @returns {{ valid: boolean, distance: number, maxAllowed: number }}
 */
export function validateCheckpointProximity(
  guardPosition,
  checkpointPosition,
  maxDistance = MAX_CHECKPOINT_DISTANCE_METERS
) {
  const distance = haversineDistance(
    guardPosition.lat, guardPosition.lng,
    checkpointPosition.lat, checkpointPosition.lng
  )

  return {
    valid: distance <= maxDistance,
    distance: Math.round(distance * 100) / 100,
    maxAllowed: maxDistance,
    message: distance <= maxDistance
      ? `Checkpoint alcanzado (${distance.toFixed(0)}m)`
      : `Muy lejos del checkpoint (${distance.toFixed(0)}m, máx ${maxDistance}m)`,
  }
}

/**
 * Validate checkpoint order (sequential completion)
 * @param {string} checkpointId
 * @param {string[]} expectedOrder - Ordered array of checkpoint IDs
 * @param {string[]} completedIds - Already completed checkpoint IDs
 * @returns {{ valid: boolean, message: string }}
 */
export function validateCheckpointOrder(checkpointId, expectedOrder, completedIds) {
  const completedSet = new Set(completedIds)
  const currentIndex = expectedOrder.indexOf(checkpointId)

  if (currentIndex === -1) {
    return { valid: false, message: 'Checkpoint no pertenece a esta ronda' }
  }

  // Check all previous checkpoints are completed
  for (let i = 0; i < currentIndex; i++) {
    if (!completedSet.has(expectedOrder[i])) {
      return {
        valid: false,
        message: `Debes completar el checkpoint ${i + 1} primero`,
        missingIndex: i,
        missingId: expectedOrder[i],
      }
    }
  }

  if (completedSet.has(checkpointId)) {
    return { valid: false, message: 'Checkpoint ya fue completado' }
  }

  return { valid: true, message: 'Checkpoint válido' }
}

// ─── GPS Validation ───

/**
 * Validate GPS accuracy meets operational requirements
 * @param {number} accuracy - GPS accuracy in meters
 * @param {number} [maxAccuracy=50] - Maximum acceptable accuracy
 * @returns {{ valid: boolean, quality: string, message: string }}
 */
//export function validateGPSAccuracy(accuracy, maxAccuracy = 50) {
export function validateGPSAccuracy(accuracy, maxAccuracy = 250) {
  if (accuracy === null || accuracy === undefined) {
    return { valid: false, quality: 'none', message: 'Sin señal GPS' }
  }

  if (accuracy <= 10) {
    return { valid: true, quality: 'high', message: `GPS preciso (±${accuracy.toFixed(0)}m)` }
  }

  if (accuracy <= 30) {
    return { valid: true, quality: 'medium', message: `GPS aceptable (±${accuracy.toFixed(0)}m)` }
  }

  if (accuracy <= maxAccuracy) {
    return { valid: true, quality: 'low', message: `GPS bajo (±${accuracy.toFixed(0)}m)` }
  }

  return {
    valid: false,
    quality: 'unusable',
    message: `GPS insuficiente (±${accuracy.toFixed(0)}m, máx ${maxAccuracy}m)`,
  }
}

/**
 * Validate guard is within operational geofence
 * @param {{ lat: number, lng: number }} position
 * @param {{ lat: number, lng: number }[]} geofencePolygon
 * @returns {{ valid: boolean, message: string }}
 */
export function validateGeofenceContainment(position, geofencePolygon) {
  if (!geofencePolygon || !geofencePolygon.length) {
    return { valid: true, message: 'Sin geocerca definida' }
  }

  const inside = isPointInPolygon(position, geofencePolygon)

  return {
    valid: inside,
    message: inside
      ? 'Dentro de la zona operativa'
      : '⚠ Fuera de la zona operativa',
  }
}

/**
 * Detect suspicious GPS jumps (potential spoofing)
 * @param {{ lat: number, lng: number }} previousPosition
 * @param {{ lat: number, lng: number }} currentPosition
 * @param {number} timeDeltaMs - Time between positions
 * @param {number} [maxSpeedMps=15] - Max plausible speed (m/s, ~54 km/h)
 * @returns {{ suspicious: boolean, speed: number, distance: number, message: string }}
 */
export function detectGPSAnomaly(
  previousPosition,
  currentPosition,
  timeDeltaMs,
  maxSpeedMps = 15
) {
  if (!previousPosition || !currentPosition || timeDeltaMs <= 0) {
    return { suspicious: false, speed: 0, distance: 0, message: 'Sin datos previos' }
  }

  const distance = haversineDistance(
    previousPosition.lat, previousPosition.lng,
    currentPosition.lat, currentPosition.lng
  )

  const speed = distance / (timeDeltaMs / 1000)

  return {
    suspicious: speed > maxSpeedMps,
    speed: Math.round(speed * 100) / 100,
    distance: Math.round(distance * 100) / 100,
    message: speed > maxSpeedMps
      ? `⚠ Velocidad sospechosa: ${speed.toFixed(1)} m/s (${(speed * 3.6).toFixed(0)} km/h)`
      : 'Movimiento normal',
  }
}

// ─── Temporal Validation ───

/**
 * Validate if a ronda is within its scheduled time window
 * @param {number} windowStart - Unix timestamp
 * @param {number} windowEnd - Unix timestamp
 * @param {number} [now] - Current time
 * @returns {{ valid: boolean, status: string, message: string, minutesRemaining: number }}
 */
export function validateTimeWindow(windowStart, windowEnd, now = Date.now()) {
  const minutesRemaining = (windowEnd - now) / 60000

  if (now < windowStart) {
    return {
      valid: false,
      status: 'early',
      message: 'Aún no es hora de iniciar esta ronda',
      minutesRemaining: (windowStart - now) / 60000,
    }
  }

  if (now > windowEnd) {
    return {
      valid: false,
      status: 'expired',
      message: 'La ventana temporal ha expirado',
      minutesRemaining: 0,
    }
  }

  if (minutesRemaining <= 10) {
    return {
      valid: true,
      status: 'urgent',
      message: `Quedan ${minutesRemaining.toFixed(0)} minutos`,
      minutesRemaining,
    }
  }

  return {
    valid: true,
    status: 'ok',
    message: `Dentro de horario (${minutesRemaining.toFixed(0)} min restantes)`,
    minutesRemaining,
  }
}

/**
 * Calculate ronda completion percentage
 * @param {number} totalCheckpoints
 * @param {number} completedCheckpoints
 * @returns {{ percentage: number, remaining: number }}
 */
export function calculateProgress(totalCheckpoints, completedCheckpoints) {
  if (totalCheckpoints === 0) return { percentage: 0, remaining: 0 }

  return {
    percentage: Math.round((completedCheckpoints / totalCheckpoints) * 100),
    remaining: totalCheckpoints - completedCheckpoints,
  }
}
