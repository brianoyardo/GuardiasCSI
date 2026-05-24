import { useEffect, useCallback } from 'react'
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { POSITION_SYNC_INTERVAL } from '@/config/constants'
import { useAuth } from '@/modules/auth/context/AuthContext'

const COLLECTION_NAME = 'guardPresence'

/**
 * SentinelOps — useGlobalPresence
 * Phase 21.4: Definitive GPS tracking + user hydration reactive hook.
 * Stores presence documents keyed by the guard's guardId (e.g. brianPrueba) for easier Firestore inspection.
 */
export function useGlobalPresence({ guardId: propGuardId, guardName: propGuardName, guardCode: propGuardCode, executionStatus = null } = {}) {
  const { user, profile, loading, profileLoading } = useAuth()

  // Dynamic derivation of identity from fully hydrated profile
  const guardId = user?.uid || propGuardId
  const guardName = profile?.fullName || user?.email || propGuardName || 'Desconocido'
  const guardCode = profile?.guardId || user?.uid?.slice(0, 6) || propGuardCode || 'N/A'

  // Document ID in guardPresence is the guardId (e.g. brianPrueba) or fallback to UID
  const presenceDocId = profile?.guardId || propGuardCode || guardId

  useEffect(() => {
    // Wait until profile is fully hydrated to avoid writing raw UID
    if (loading || profileLoading) return
    if (!presenceDocId) return

    const docRef = doc(db, COLLECTION_NAME, presenceDocId)

    // Write initial presence doc with correct schema and identity
    setDoc(
      docRef,
      {
        guardId,      // The UID of the user: CDXYkmCdH5Ml3BYLVVDULLjJZUy1
        guardName,    // The full name of the user: Brian Ayardo
        guardCode,    // The guardId of the user: brianPrueba
        status: executionStatus || 'online',
        lastUpdate: serverTimestamp(),
      },
      { merge: true }
    ).catch((err) => console.error('Error al crear presencia inicial:', err))

    // Realtime watchPosition for fluid green dot rendering
    let lastUpdateTimestamp = 0;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastUpdateTimestamp < 5000) {
          return; // Skip database write to avoid excessive writes
        }
        lastUpdateTimestamp = now;

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

    // Setup heartbeat (run every 15 seconds to save resources)
    const heartbeatInterval = setInterval(() => {
      setDoc(
        docRef,
        {
          status: executionStatus || 'online',
          lastUpdate: serverTimestamp(),
        },
        { merge: true }
      ).catch((err) => console.error('Error latido de presencia:', err))
    }, 5000)

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
      clearInterval(heartbeatInterval)
    }
  }, [presenceDocId, guardId, guardName, guardCode, executionStatus, loading, profileLoading])

  const clearPresence = useCallback(async () => {
    if (!presenceDocId) return
    try {
      await setDoc(
        doc(db, COLLECTION_NAME, presenceDocId),
        {
          status: 'offline',
          lastUpdate: serverTimestamp(),
        },
        { merge: true }
      )
    } catch (err) {
      console.error('[useGlobalPresence] Error clearing presence:', err)
    }
  }, [presenceDocId])

  return { clearPresence }
}
