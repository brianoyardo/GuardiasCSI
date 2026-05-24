import { useEffect, useRef, useCallback } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS } from '@/config/constants'

/**
 * SentinelOps — useRealtimeLocation Hook
 * Subscribes to a guard's real-time position via Firestore onSnapshot
 * 
 * Architecture note: This is the Firestore-based realtime layer.
 * In the future, this can be swapped for Socket.IO/MQTT without
 * changing the consumer interface.
 * 
 * Prepared for: monitoring dashboard, live map, supervisor views
 */

const LOG_PREFIX = '[useRealtimeLocation]'

/**
 * Subscribe to a single guard's real-time location updates
 * @param {string|null} guardId - User ID to track (null = disabled)
 * @param {object} [options]
 * @param {Function} [options.onUpdate] - Callback on position update
 * @param {Function} [options.onError] - Callback on error
 */
export function useRealtimeLocation(guardId, options = {}) {
  const { onUpdate, onError } = options
  const unsubRef = useRef(null)

  const subscribe = useCallback(() => {
    if (!guardId) return

    // console.log(`${LOG_PREFIX} 🔴 Subscribing to location: ${guardId}`)

    // Subscribe to the guard's latest execution document
    // In a full implementation, this would listen to a dedicated
    // "liveLocations" collection updated by the guard's device
    const executionRef = doc(db, 'Live', `live_${guardId}`)

    unsubRef.current = onSnapshot(
      executionRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data()
          const position = data.lastPosition || data.gpsTrack?.slice(-1)[0]

          if (position && onUpdate) {
            onUpdate({
              guardId,
              position: { lat: position.lat, lng: position.lng },
              timestamp: position.timestamp || Date.now(),
              status: data.status,
              accuracy: position.accuracy,
            })
          }
        }
      },
      (error) => {
        console.error(`${LOG_PREFIX} Subscription error:`, error)
        if (onError) onError(error)
      }
    )
  }, [guardId, onUpdate, onError])

  const unsubscribe = useCallback(() => {
    if (unsubRef.current) {
      unsubRef.current()
      unsubRef.current = null
      // console.log(`${LOG_PREFIX} ⏹ Unsubscribed from: ${guardId}`)
    }
  }, [guardId])

  useEffect(() => {
    subscribe()
    return () => unsubscribe()
  }, [subscribe, unsubscribe])

  return { subscribe, unsubscribe }
}

/**
 * Batch subscribe to multiple guards' locations
 * For monitoring dashboard with multiple active guards
 * 
 * @param {string[]} guardIds
 * @param {Function} onUpdate - Called with { guardId, position, ... }
 */
export function useMultiGuardTracking(guardIds = [], onUpdate) {
  const unsubsRef = useRef(new Map())

  useEffect(() => {
    // Unsubscribe from guards no longer in the list
    for (const [id, unsub] of unsubsRef.current) {
      if (!guardIds.includes(id)) {
        unsub()
        unsubsRef.current.delete(id)
      }
    }

    // Subscribe to new guards
    for (const guardId of guardIds) {
      if (!unsubsRef.current.has(guardId)) {
        const executionRef = doc(db, 'Live', `live_${guardId}`)

        const unsub = onSnapshot(executionRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data()
            const position = data.lastPosition
            if (position && onUpdate) {
              onUpdate({
                guardId,
                position: { lat: position.lat, lng: position.lng },
                timestamp: position.timestamp || Date.now(),
                status: data.status,
              })
            }
          }
        })

        unsubsRef.current.set(guardId, unsub)
      }
    }

    return () => {
      for (const unsub of unsubsRef.current.values()) {
        unsub()
      }
      unsubsRef.current.clear()
    }
  }, [guardIds, onUpdate])
}
