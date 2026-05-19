import { useState, useCallback, useRef, useEffect } from 'react'
import { isPointInPolygon, haversineDistance } from '@/modules/maps/utils/geoUtils'

/**
 * SentinelOps — useGeofence Hook
 * Spatial containment validation for geocercas
 * 
 * Features:
 *   - Point-in-polygon check
 *   - Entry/exit event detection
 *   - Multiple geofence support
 *   - Distance to boundary
 *   - Prepared for alert triggers (n8n webhooks)
 */

const LOG_PREFIX = '[useGeofence]'

/**
 * @typedef {Object} Geofence
 * @property {string} id
 * @property {string} name
 * @property {{ lat: number, lng: number }[]} polygon - Vertices
 * @property {string} [type] - 'operational_zone' | 'restricted' | 'patrol_area'
 */

/**
 * @param {Geofence[]} geofences - Array of geofence definitions
 * @param {{ lat: number, lng: number } | null} currentPosition
 */
export function useGeofence(geofences = [], currentPosition = null) {
  const [activeGeofences, setActiveGeofences] = useState([])
  const [violations, setViolations] = useState([])
  const previousStateRef = useRef(new Map()) // geofenceId → boolean (was inside)

  /**
   * Check position against all geofences
   */
  const checkPosition = useCallback(
    (position) => {
      if (!position || !geofences.length) return

      const inside = []
      const newViolations = []

      geofences.forEach((fence) => {
        const isInside = isPointInPolygon(position, fence.polygon)
        const wasInside = previousStateRef.current.get(fence.id) || false

        if (isInside) {
          inside.push(fence.id)
        }

        // Entry event
        if (isInside && !wasInside) {
          // console.log(`${LOG_PREFIX} 🟢 ENTRY: "${fence.name}" (${fence.id})`)
          newViolations.push({
            type: 'entry',
            geofenceId: fence.id,
            geofenceName: fence.name,
            timestamp: Date.now(),
            position: { ...position },
          })
        }

        // Exit event
        if (!isInside && wasInside) {
          // console.log(`${LOG_PREFIX} 🔴 EXIT: "${fence.name}" (${fence.id})`)
          newViolations.push({
            type: 'exit',
            geofenceId: fence.id,
            geofenceName: fence.name,
            timestamp: Date.now(),
            position: { ...position },
          })
        }

        previousStateRef.current.set(fence.id, isInside)
      })

      setActiveGeofences(inside)

      if (newViolations.length) {
        setViolations((prev) => [...prev, ...newViolations])
      }
    },
    [geofences]
  )

  // Auto-check when position changes
  useEffect(() => {
    if (currentPosition) {
      checkPosition(currentPosition)
    }
  }, [currentPosition, checkPosition])

  /**
   * Check if currently inside a specific geofence
   */
  const isInsideGeofence = useCallback(
    (geofenceId) => activeGeofences.includes(geofenceId),
    [activeGeofences]
  )

  /**
   * Clear violation history
   */
  const clearViolations = useCallback(() => {
    setViolations([])
  }, [])

  return {
    activeGeofences,
    violations,
    isInsideGeofence,
    checkPosition,
    clearViolations,
    isInsideAny: activeGeofences.length > 0,
  }
}
