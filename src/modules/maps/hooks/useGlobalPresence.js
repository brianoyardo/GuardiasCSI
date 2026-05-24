import { useEffect, useRef, useCallback } from 'react'
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS, POSITION_SYNC_INTERVAL } from '@/config/constants'

const COLLECTION_NAME = 'guardPresence'

/**
 * SentinelOps — useGlobalPresence
 * Phase 21.3: Direct updateDoc on watchPosition for true real-time movement.
 * 
 * - Creates the initial presence document with full identity fields via setDoc.
 * - Updates location in real-time via updateDoc on each GPS fix (distanceFilter: 3m native).
 * - Heartbeat keeps status + lastUpdate alive for the ACTIVE_THRESHOLD check.
 */
export function useGlobalPresence({ guardId, guardName, guardCode, executionStatus = null }) {
  const watchIdRef = useRef(null)
  const heartbeatRef = useRef(null)
  const guardIdRef = useRef(guardId)
  const statusRef = useRef(executionStatus)

  guardIdRef.current = guardId
  statusRef.current = executionStatus

  // ─── Initial presence document (full identity) ───
  const ensurePresenceDoc = useCallback(async (position) => {
    if (!guardIdRef.current) return
    try {
      const payload = {
        guardId: guardIdRef.current,
        guardName: guardName || 'Desconocido',
        guardCode: guardCode || '',
        status: statusRef.current || 'online',
        lastUpdate: serverTimestamp(),
      }

      // Include location if available
      if (position?.coords) {
        payload.location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        payload.accuracy = position.coords.accuracy || null
      }

      await setDoc(
        doc(db, COLLECTION_NAME, guardIdRef.current),
        payload,
        { merge: true }
      )
    } catch (err) {
      console.error('[useGlobalPresence] Error creating presence:', err)
    }
  }, [guardName, guardCode])

  // ─── Heartbeat (keeps lastUpdate fresh for threshold detection) ───
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
    let initialDocCreated = false

    const startTracking = () => {
      if (watchIdRef.current !== null) return

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          if (!mounted) return

          const { latitude, longitude } = pos.coords

          // First fix: create the full document with identity
          if (!initialDocCreated) {
            initialDocCreated = true
            ensurePresenceDoc(pos)
            return
          }

          // Subsequent fixes: direct updateDoc for real-time location
          if (guardIdRef.current) {
            const docRef = doc(db, COLLECTION_NAME, guardIdRef.current)
            updateDoc(docRef, {
              'location.lat': latitude,
              'location.lng': longitude,
              lastUpdate: serverTimestamp()
            }).catch(err => console.error('Error actualizando ubicación en vivo:', err))
          }
        },
        (err) => console.error('Error GPS:', err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
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
  }, [guardId, executionStatus, ensurePresenceDoc, heartbeat])

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
