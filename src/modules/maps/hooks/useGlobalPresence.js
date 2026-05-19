import { useEffect, useRef, useCallback } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS, POSITION_SYNC_INTERVAL } from '@/config/constants'

const COLLECTION_NAME = 'guardPresence'

export function useGlobalPresence({ guardId, guardName, guardCode, executionStatus = null }) {
  const watchIdRef = useRef(null)
  const intervalRef = useRef(null)
  const guardIdRef = useRef(guardId)

  guardIdRef.current = guardId

  const updatePresence = useCallback(async (position, status) => {
    if (!guardIdRef.current) return
    try {
      await setDoc(
        doc(db, COLLECTION_NAME, guardIdRef.current),
        {
          guardId: guardIdRef.current,
          guardName: guardName || '',
          guardCode: guardCode || '',
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          accuracy: position.coords.accuracy || null,
          status: status || 'online',
          lastUpdate: serverTimestamp(),
        },
        { merge: true }
      )
    } catch (err) {
      console.error('[useGlobalPresence] Error updating presence:', err)
    }
  }, [guardName, guardCode])

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
        (err) => {
          console.error('[useGlobalPresence] watchPosition error:', err)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: POSITION_SYNC_INTERVAL,
        }
      )
    }

    startTracking()

    intervalRef.current = setInterval(() => {
      if (!mounted) return
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!mounted) return
          updatePresence(position, executionStatus)
        },
        () => {},
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      )
    }, POSITION_SYNC_INTERVAL)

    return () => {
      mounted = false
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [guardId, executionStatus, updatePresence])

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
