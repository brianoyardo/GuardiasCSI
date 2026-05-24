import { useEffect, useRef, useCallback } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS, POSITION_SYNC_INTERVAL } from '@/config/constants'

const COLLECTION_NAME = 'guardPresence'

/**
 * Minimum distance in meters before a new position update is sent to Firestore.
 * Prevents NoSQL saturation while ensuring fluid real-time tracking.
 * Phase 21.2: Distance-based throttle for true real-time movement.
 */
const MIN_DISTANCE_METERS = 3

/**
 * Haversine distance between two lat/lng points (in meters)
 */
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000 // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function useGlobalPresence({ guardId, guardName, guardCode, executionStatus = null }) {
  const watchIdRef = useRef(null)
  const heartbeatRef = useRef(null)
  const guardIdRef = useRef(guardId)
  const statusRef = useRef(executionStatus)
  const lastSentRef = useRef({ lat: null, lng: null })

  guardIdRef.current = guardId
  statusRef.current = executionStatus

  const updatePresence = useCallback(async (position, status) => {
    if (!guardIdRef.current) return

    const lat = position?.coords?.latitude
    const lng = position?.coords?.longitude

    // Phase 21.2: Distance-based throttle — skip if guard hasn't moved enough
    if (lat != null && lng != null && lastSentRef.current.lat != null) {
      const dist = getDistanceMeters(
        lastSentRef.current.lat, lastSentRef.current.lng,
        lat, lng
      )
      if (dist < MIN_DISTANCE_METERS) return
    }

    // Update last sent position
    if (lat != null && lng != null) {
      lastSentRef.current = { lat, lng }
    }

    try {
      await setDoc(
        doc(db, COLLECTION_NAME, guardIdRef.current),
        {
          guardId: guardIdRef.current,
          guardName: guardName || 'Sin nombre',
          guardCode: guardCode || '',
          location: (lat != null && lng != null) ? { lat, lng } : undefined,
          accuracy: position?.coords?.accuracy || null,
          status: status || 'online',
          lastUpdate: serverTimestamp(),
        },
        { merge: true }
      )
    } catch (err) {
      // Silenced during dev until Firestore rules are deployed
    }
  }, [guardName, guardCode])

  const heartbeat = useCallback(async () => {
    if (!guardIdRef.current) return
    try {
      await setDoc(
        doc(db, COLLECTION_NAME, guardIdRef.current),
        {
          status: statusRef.current || 'online',
          lastUpdate: serverTimestamp(),
        },
        { merge: true }
      )
    } catch (err) {
      // Silenced
    }
  }, [])

  useEffect(() => {
    if (!guardId) return

    let mounted = true

    const startTracking = () => {
      if (watchIdRef.current !== null) return

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          if (!mounted) return
          updatePresence(position, executionStatus)
        },
        () => {},
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0, // Phase 21.2: No cache — always fresh GPS position
        }
      )
    }

    startTracking()

    heartbeatRef.current = setInterval(() => {
      if (!mounted) return
      heartbeat()
    }, POSITION_SYNC_INTERVAL)

    return () => {
      mounted = false
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
    }
  }, [guardId, executionStatus, updatePresence, heartbeat])

  const clearPresence = useCallback(async () => {
    if (!guardId) return
    try {
      await setDoc(
        doc(db, COLLECTION_NAME, guardId),
        {
          status: 'offline',
          lastUpdate: serverTimestamp(),
        },
        { merge: true }
      )
    } catch (err) {
      console.error('[useGlobalPresence] Error clearing presence:', err)
    }
  }, [guardId])

  return { clearPresence }
}
