import { eventBus } from '../events/eventBus'
import { OPERATIONAL_EVENTS } from '../events/eventTaxonomy'
import { detectInactivity, detectSpeedAnomaly, detectAccuracyAnomaly } from './detectionRules'

/**
 * SentinelOps — Detection Engine (Orchestrator)
 * Evaluates real-time streams (like GPS updates) to detect anomalies.
 * Dispatches events to the EventBus when rules are violated.
 * 
 * Note: Actual turf/spatial logic has been moved to detectionRules.js
 * to prepare for Web Worker migration.
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

    // 1. Detect GPS Anomaly (Accuracy)
    const accuracyAnomaly = detectAccuracyAnomaly(gpsPoint)
    if (accuracyAnomaly) {
      eventBus.publish(OPERATIONAL_EVENTS.GPS_ANOMALY, {
        guardId,
        executionId,
        position: gpsPoint,
        ...accuracyAnomaly
      })
    }

    if (lastState) {
      // 2. Detect Inactivity
      const inactivityAlert = detectInactivity(lastState, gpsPoint, now)
      if (inactivityAlert) {
        eventBus.publish(OPERATIONAL_EVENTS.GUARD_INACTIVE, {
          guardId,
          executionId,
          position: gpsPoint,
          ...inactivityAlert
        })
      }

      // 3. Detect Impossible Speed / Teleportation
      const speedAnomaly = detectSpeedAnomaly(lastState, gpsPoint, now)
      if (speedAnomaly) {
        eventBus.publish(OPERATIONAL_EVENTS.GPS_ANOMALY, {
          guardId,
          executionId,
          position: gpsPoint,
          ...speedAnomaly
        })
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
