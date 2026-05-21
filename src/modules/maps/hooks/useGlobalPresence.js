import { useEffect, useRef, useCallback } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS, POSITION_SYNC_INTERVAL } from '@/config/constants'

const COLLECTION_NAME = 'guardPresence'

export function useGlobalPresence({ guardId, guardName, guardCode, executionStatus = null }) {
  const watchIdRef = useRef(null)
  const heartbeatRef = useRef(null)
  const guardIdRef = useRef(guardId)
  const statusRef = useRef(executionStatus)

  guardIdRef.current = guardId
  statusRef.current = executionStatus

  const updatePresence = useCallback(async (position, status) => {
    if (!guardIdRef.current) return
    try {
      await setDoc(
        doc(db, COLLECTION_NAME, guardIdRef.current),
        {
          guardId: guardIdRef.current,
          guardName: guardName || '',
          guardCode: guardCode || '',
          location: position ? {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          } : undefined,
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
          maximumAge: POSITION_SYNC_INTERVAL,
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
