import { eventBus } from '../events/eventBus'
import { OPERATIONAL_EVENTS } from '../events/eventTaxonomy'
import * as turf from '@turf/turf'

/**
 * SentinelOps — Detection Engine
 * Evaluates real-time streams (like GPS updates) to detect anomalies.
 * Dispatches events to the EventBus when rules are violated.
 */

const LOG_PREFIX = '[DetectionEngine]'

class DetectionEngine {
  constructor() {
    this.activeGuards = new Map() // Tracks state per guard
  }

  /**
   * Process an incoming GPS update from a guard
   * @param {string} guardId 
   * @param {string} executionId 
   * @param {{lat: number, lng: number, accuracy: number, timestamp: number}} gpsPoint 
   */
  processGpsUpdate(guardId, executionId, gpsPoint) {
    const now = Date.now()
    const lastState = this.activeGuards.get(guardId)

    // 1. Detect GPS Anomaly (e.g., accuracy > 100m is unreliable)
    if (gpsPoint.accuracy && gpsPoint.accuracy > 100) {
      eventBus.publish(OPERATIONAL_EVENTS.GPS_ANOMALY, {
        guardId,
        executionId,
        position: gpsPoint,
        accuracy: gpsPoint.accuracy,
        reason: 'Low Accuracy'
      })
    }

    if (lastState) {
      // 2. Detect Inactivity (No movement > 15 meters in 5 minutes)
      const timeDiffMins = (now - lastState.timestamp) / 1000 / 60
      
      if (timeDiffMins > 5) {
        const from = turf.point([lastState.position.lng, lastState.position.lat])
        const to = turf.point([gpsPoint.lng, gpsPoint.lat])
        const distanceMeters = turf.distance(from, to, { units: 'kilometers' }) * 1000

        if (distanceMeters < 15) {
          eventBus.publish(OPERATIONAL_EVENTS.GUARD_INACTIVE, {
            guardId,
            executionId,
            position: gpsPoint,
            inactiveMinutes: timeDiffMins,
            distanceMovedMeters: distanceMeters
          })
        }
      }

      // 3. Detect Impossible Speed / Teleportation
      // Speed > 40 km/h for a guard on foot is suspicious
      if (timeDiffMins > 0) {
        const from = turf.point([lastState.position.lng, lastState.position.lat])
        const to = turf.point([gpsPoint.lng, gpsPoint.lat])
        const distanceKm = turf.distance(from, to, { units: 'kilometers' })
        const timeDiffHours = timeDiffMins / 60
        const speedKmh = distanceKm / timeDiffHours

        if (speedKmh > 40) {
          eventBus.publish(OPERATIONAL_EVENTS.GPS_ANOMALY, {
            guardId,
            executionId,
            position: gpsPoint,
            speedKmh,
            reason: 'Impossible Speed'
          })
        }
      }
    }

    // Update last known state
    this.activeGuards.set(guardId, {
      position: gpsPoint,
      timestamp: now,
      executionId
    })
  }

  /**
   * Clear tracking state for a guard (e.g. when ronda finishes)
   */
  clearGuard(guardId) {
    this.activeGuards.delete(guardId)
  }
}

export const detectionEngine = new DetectionEngine()
