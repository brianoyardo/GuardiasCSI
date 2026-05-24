import { useEffect, useCallback } from 'react'
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { POSITION_SYNC_INTERVAL } from '@/config/constants'
import { useAuth } from '@/modules/auth/context/AuthContext'

const COLLECTION_NAME = 'guardPresence'

/**
 * SentinelOps — useGlobalPresence
 * Phase 21.4: Definitive GPS tracking + user hydration reactive hook.
 */
export function useGlobalPresence({ guardId: propGuardId, guardName: propGuardName, guardCode: propGuardCode, executionStatus = null } = {}) {
  const { user } = useAuth()

  // Dynamic derivation of identity to avoid auth hydration lag
  const guardId = user?.uid || propGuardId
  const guardName = user?.fullName || user?.email || propGuardName || 'Desconocido'
  const guardCode = user?.guardId || user?.uid?.slice(0, 6) || propGuardCode || 'N/A'

  useEffect(() => {
    if (!guardId) return

    const docRef = doc(db, COLLECTION_NAME, guardId)

    // Write initial presence doc with correct schema and identity
    setDoc(
      docRef,
      {
        guardId,
        guardName,
        guardCode,
        status: executionStatus || 'online',
        lastUpdate: serverTimestamp(),
      },
      { merge: true }
    ).catch((err) => console.error('Error al crear presencia inicial:', err))

    // Realtime watchPosition for fluid green dot rendering
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        updateDoc(docRef, {
          'location.lat': latitude,
          'location.lng': longitude,
          lastUpdate: serverTimestamp()
        }).catch((err) => console.error('Error actualizando ubicación en vivo:', err))
      },
      (err) => console.error('Error GPS:', err),
      { enableHighAccuracy: true, maximumAge: 0, distanceFilter: 3 }
    )

    // Setup heartbeat
    const heartbeatInterval = setInterval(() => {
      setDoc(
        docRef,
        {
          status: executionStatus || 'online',
          lastUpdate: serverTimestamp(),
        },
        { merge: true }
      ).catch((err) => console.error('Error latido de presencia:', err))
    }, POSITION_SYNC_INTERVAL)

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
      clearInterval(heartbeatInterval)
    }
  }, [guardId, guardName, guardCode, executionStatus])

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
