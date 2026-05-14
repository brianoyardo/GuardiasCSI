import { useState, useCallback } from 'react'
import {
  validateCheckpointProximity,
  validateCheckpointOrder,
  validateGPSAccuracy,
  validateGeofenceContainment,
  calculateProgress,
} from '@/modules/rondas/validators/rondaValidators'

/**
 * SentinelOps — useCheckpointValidation Hook
 * Orchestrates all checkpoint validations during ronda execution
 * 
 * Combines: proximity, order, GPS accuracy, geofence
 * Returns: unified validation result
 */

/**
 * @param {object} options
 * @param {object[]} options.checkpoints - Ordered checkpoint array
 * @param {string[]} options.checkpointOrder - Ordered checkpoint IDs
 * @param {{ lat: number, lng: number }[]} [options.geofencePolygon]
 */
export function useCheckpointValidation(options = {}) {
  const {
    checkpoints = [],
    checkpointOrder = [],
    geofencePolygon = null,
  } = options

  const [completedIds, setCompletedIds] = useState([])
  const [lastValidation, setLastValidation] = useState(null)

  /**
   * Validate a checkpoint against all rules
   * @param {string} checkpointId
   * @param {{ lat: number, lng: number }} guardPosition
   * @param {number} gpsAccuracy
   * @returns {{ canComplete: boolean, results: object }}
   */
  const validate = useCallback(
    (checkpointId, guardPosition, gpsAccuracy) => {
      const checkpoint = checkpoints.find((cp) => cp.id === checkpointId)

      if (!checkpoint) {
        const result = { canComplete: false, reason: 'Checkpoint no encontrado' }
        setLastValidation(result)
        return result
      }

      const cpPosition = {
        lat: checkpoint.lat || checkpoint.latitude,
        lng: checkpoint.lng || checkpoint.longitude,
      }

      // Run all validations
      const proximity = validateCheckpointProximity(guardPosition, cpPosition)
      const order = validateCheckpointOrder(checkpointId, checkpointOrder, completedIds)
      const gps = validateGPSAccuracy(gpsAccuracy)

      const geofence = geofencePolygon
        ? validateGeofenceContainment(guardPosition, geofencePolygon)
        : { valid: true, message: 'Sin geocerca' }

      const canComplete = proximity.valid && order.valid && gps.valid
      const progress = calculateProgress(checkpoints.length, completedIds.length)

      const result = {
        canComplete,
        checkpointId,
        results: { proximity, order, gps, geofence },
        progress,
        reason: !canComplete
          ? [
              !proximity.valid && proximity.message,
              !order.valid && order.message,
              !gps.valid && gps.message,
            ].filter(Boolean).join(' | ')
          : 'Validación exitosa',
      }

      setLastValidation(result)
      return result
    },
    [checkpoints, checkpointOrder, completedIds, geofencePolygon]
  )

  /**
   * Mark a checkpoint as completed (after successful validation)
   */
  const markCompleted = useCallback((checkpointId) => {
    setCompletedIds((prev) => [...prev, checkpointId])
  }, [])

  /**
   * Reset all completions
   */
  const reset = useCallback(() => {
    setCompletedIds([])
    setLastValidation(null)
  }, [])

  /**
   * Get the next expected checkpoint
   */
  const getNextCheckpoint = useCallback(() => {
    const completedSet = new Set(completedIds)
    const nextId = checkpointOrder.find((id) => !completedSet.has(id))
    if (!nextId) return null
    return checkpoints.find((cp) => cp.id === nextId) || null
  }, [completedIds, checkpointOrder, checkpoints])

  return {
    completedIds,
    completedCount: completedIds.length,
    totalCheckpoints: checkpoints.length,
    progress: calculateProgress(checkpoints.length, completedIds.length),
    isAllComplete: completedIds.length === checkpoints.length && checkpoints.length > 0,
    lastValidation,
    nextCheckpoint: getNextCheckpoint(),
    validate,
    markCompleted,
    reset,
  }
}
