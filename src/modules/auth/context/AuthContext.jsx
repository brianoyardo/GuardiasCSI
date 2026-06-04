import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '@/config/firebase'
import { ensureUserProfile } from '@/modules/users/services/userService'
import { hasPermission, ROLES } from '@/config/roles'
import { USER_STATUS } from '@/config/constants'
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'

/**
 * AuthContext — provides user, profile (with role), and loading state
 * Handles automatic Auth → Firestore synchronization, Shift timings, and Live Deactivation
 */
const AuthContext = createContext(null)

const LOG_PREFIX = '[AuthContext]'

/**
 * Helper to check if current time is within a shift schedule (with buffer minutes)
 * Handles night shifts (shifts that cross midnight)
 * @param {string} shiftStart - e.g. "08:00"
 * @param {string} shiftEnd - e.g. "16:00"
 * @param {number} [bufferMinutes=60] - Allowed early login buffer in minutes
 * @returns {boolean}
 */
export function isTimeInShift(shiftStart, shiftEnd, bufferMinutes = 60) {
  if (!shiftStart || !shiftEnd) return true // Graceful fallback if no shift assigned

  const now = new Date()
  const currentMin = now.getHours() * 60 + now.getMinutes()

  const [startHour, startMin] = shiftStart.split(':').map(Number)
  const [endHour, endMin] = shiftEnd.split(':').map(Number)

  const shiftStartMin = startHour * 60 + startMin
  const shiftEndMin = endHour * 60 + endMin

  // Early window starts bufferMinutes before shiftStartMin
  let allowedStartMin = shiftStartMin - bufferMinutes
  if (allowedStartMin < 0) {
    allowedStartMin += 1440 // wrap back to previous day
  }

  // Crosses midnight check
  const crossesMidnight = shiftEndMin < shiftStartMin

  if (!crossesMidnight) {
    if (allowedStartMin > shiftStartMin) {
      return currentMin >= allowedStartMin || currentMin <= shiftEndMin
    }
    return currentMin >= allowedStartMin && currentMin <= shiftEndMin
  } else {
    return currentMin >= allowedStartMin || currentMin <= shiftEndMin
  }
}

/**
 * Helper to get the operational date of the shift
 * If shift crosses midnight and we are in the early morning part (e.g. before shiftEnd),
 * the shift start date was actually yesterday.
 */
export function getShiftDate(shiftStart, shiftEnd) {
  const now = new Date()
  if (!shiftStart || !shiftEnd) {
    return now.toISOString().split('T')[0]
  }

  const [startHour] = shiftStart.split(':').map(Number)
  const [endHour] = shiftEnd.split(':').map(Number)

  if (endHour < startHour) {
    const currentHour = now.getHours()
    if (currentHour < endHour) {
      const yesterday = new Date(now)
      yesterday.setDate(now.getDate() - 1)
      return yesterday.toISOString().split('T')[0]
    }
  }
  return now.toISOString().split('T')[0]
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [showDeactivatedAlert, setShowDeactivatedAlert] = useState(false)

  // Real-time user status monitor
  useEffect(() => {
    if (!profile?.id) return

    const userDocRef = doc(db, 'users', profile.id)
    const unsubscribe = onSnapshot(userDocRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data()
        
        // If status becomes inactive in database while online
        if (data.status === USER_STATUS.INACTIVE) {
          setShowDeactivatedAlert(true)
          
          // Wait 3 seconds, then log out
          const logoutTimer = setTimeout(async () => {
            await auth.signOut()
            setUser(null)
            setProfile(null)
            setError('Su cuenta ha sido desactivada. Por favor contacte al administrador para más detalles.')
            setShowDeactivatedAlert(false)
          }, 3000)

          return () => clearTimeout(logoutTimer)
        } else {
          // Keep local profile reactive
          setProfile({ id: snapshot.id, ...data })
        }
      }
    }, (err) => {
      console.error(`${LOG_PREFIX} Live monitor error:`, err)
    })

    return () => unsubscribe()
  }, [profile?.id])

  useEffect(() => {
    // console.log(`${LOG_PREFIX} 🚀 Initializing auth state listener...`)

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setUser(firebaseUser)
          setProfileLoading(true)
          setError(null)

          // Sync Auth → Firestore: ensures profile exists
          const userProfile = await ensureUserProfile(firebaseUser)

          // Validate user status
          if (userProfile.status === USER_STATUS.SUSPENDED) {
            setError('Tu cuenta ha sido suspendida. Contacta al administrador.')
            setProfile(null)
            await auth.signOut()
            setUser(null)
            return
          }

          if (userProfile.status === USER_STATUS.INACTIVE) {
            setError('Tu cuenta está inactiva. Contacta al administrador.')
            setProfile(null)
            await auth.signOut()
            setUser(null)
            return
          }

          // Shift validation for guards
          if (userProfile.role === ROLES.GUARD) {
            const { shiftStart, shiftEnd, shiftEnabled } = userProfile
            if (shiftEnabled && shiftStart && shiftEnd) {
              if (!isTimeInShift(shiftStart, shiftEnd)) {
                setError(`Acceso restringido: Fuera de horario de turno asignado (${shiftStart} - ${shiftEnd}).`)
                setProfile(null)
                await auth.signOut()
                setUser(null)
                return
              }
            }
          }

          setProfile(userProfile)

          // Automatic Clock-In registration on successful login during shift
          if (userProfile.role === ROLES.GUARD && userProfile.shiftEnabled && userProfile.shiftStart && userProfile.shiftEnd) {
            const shiftDate = getShiftDate(userProfile.shiftStart, userProfile.shiftEnd)
            const attendanceDocId = `attendance_${userProfile.uid || userProfile.id}_${shiftDate}`
            const attendanceRef = doc(db, 'personalAttendance', attendanceDocId)
            
            try {
              const attSnap = await getDoc(attendanceRef)
              if (!attSnap.exists()) {
                await setDoc(attendanceRef, {
                  guardId: userProfile.uid || userProfile.id,
                  guardName: userProfile.fullName || firebaseUser.displayName || firebaseUser.email || 'Desconocido',
                  guardCode: userProfile.guardId || 'N/A',
                  date: shiftDate,
                  clockIn: serverTimestamp(),
                  clockOut: null,
                  shiftStart: userProfile.shiftStart,
                  shiftEnd: userProfile.shiftEnd,
                  status: 'present',
                  createdAt: serverTimestamp()
                })
              }
            } catch (attErr) {
              console.error(`${LOG_PREFIX} Error during auto clock-in registration:`, attErr)
            }
          }

        } else {
          setUser(null)
          setProfile(null)
          setError(null)
        }
      } catch (err) {
        setError(
          err.code === 'permission-denied'
            ? 'Sin permisos para acceder al sistema. Contacta al administrador.'
            : `Error cargando perfil: ${err.message}`
        )
        setProfile(null)
      } finally {
        setLoading(false)
        setProfileLoading(false)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  /**
   * Check if current user has a specific permission
   */
  const checkPermission = useCallback(
    (permission) => {
      if (!profile?.role) return false
      return hasPermission(profile.role, permission)
    },
    [profile?.role]
  )

  /**
   * Refresh profile from Firestore
   */
  const refreshProfile = useCallback(async () => {
    if (!user) return
    setProfileLoading(true)
    try {
      const updated = await ensureUserProfile(user)
      setProfile(updated)
    } catch (err) {
      // console.error(`${LOG_PREFIX} Error refreshing profile:`, err)
    } finally {
      setProfileLoading(false)
    }
  }, [user])

  const value = {
    user,
    profile,
    role: profile?.role || null,
    loading,
    profileLoading,
    error,
    isAuthenticated: !!user && !!profile,
    isProfileComplete: !!profile?.role && !!profile?.status,
    checkPermission,
    refreshProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showDeactivatedAlert && (
        <>
          <style>{`
            @keyframes scaleIn {
              from { transform: scale(0.95); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
          `}</style>
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(5, 5, 10, 0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            color: '#fff',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            <div style={{
              background: '#0d0e16',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '16px',
              padding: '2.5rem',
              textAlign: 'center',
              maxWidth: '420px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(239, 68, 68, 0.1)',
              animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
            }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '1rem', filter: 'drop-shadow(0 0 15px rgba(239, 68, 68, 0.4))' }}>⚠️</div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171', marginBottom: '0.75rem', letterSpacing: '-0.5px' }}>
                Cuenta Desactivada
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                Su cuenta ha sido desactivada. Por favor contacte al administrador para más detalles.
              </p>
            </div>
          </div>
        </>
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
