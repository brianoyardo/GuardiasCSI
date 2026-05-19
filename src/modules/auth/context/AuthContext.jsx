import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/config/firebase'
import { ensureUserProfile } from '@/modules/users/services/userService'
import { hasPermission } from '@/config/roles'
import { USER_STATUS } from '@/config/constants'

/**
 * AuthContext — provides user, profile (with role), and loading state
 * Handles automatic Auth → Firestore synchronization
 */
const AuthContext = createContext(null)

const LOG_PREFIX = '[AuthContext]'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    // console.log(`${LOG_PREFIX} 🚀 Initializing auth state listener...`)

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // console.log(`${LOG_PREFIX} Auth state changed:`, firebaseUser ? firebaseUser.email : 'null')

      try {
        if (firebaseUser) {
          setUser(firebaseUser)
          setProfileLoading(true)
          setError(null)

          // Sync Auth → Firestore: ensures profile exists
          const userProfile = await ensureUserProfile(firebaseUser)

          // Validate user status
          if (userProfile.status === USER_STATUS.SUSPENDED) {
            // console.warn(`${LOG_PREFIX} ⚠ User is suspended: ${firebaseUser.email}`)
            setError('Tu cuenta ha sido suspendida. Contacta al administrador.')
            setProfile(null)
            // Sign out suspended users
            await auth.signOut()
            setUser(null)
            return
          }

          if (userProfile.status === USER_STATUS.INACTIVE) {
            // console.warn(`${LOG_PREFIX} ⚠ User is inactive: ${firebaseUser.email}`)
            setError('Tu cuenta está inactiva. Contacta al administrador.')
            setProfile(null)
            await auth.signOut()
            setUser(null)
            return
          }

          setProfile(userProfile)
          // console.log(`${LOG_PREFIX} ✅ Auth + Profile loaded:`, {
          //   uid: userProfile.id || userProfile.uid,
          //   email: userProfile.email,
          //   role: userProfile.role,
          //   status: userProfile.status,
          // })
        } else {
          // console.log(`${LOG_PREFIX} User signed out`)
          setUser(null)
          setProfile(null)
          setError(null)
        }
      } catch (err) {
        console.error(`${LOG_PREFIX} ❌ Error in auth state handler:`, err)
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
      // console.log(`${LOG_PREFIX} Cleaning up auth listener`)
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
    // Auth state
    user,
    profile,
    role: profile?.role || null,
    loading,
    profileLoading,
    error,

    // Computed flags
    isAuthenticated: !!user && !!profile,
    isProfileComplete: !!profile?.role && !!profile?.status,

    // Methods
    checkPermission,
    refreshProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to access auth context
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
