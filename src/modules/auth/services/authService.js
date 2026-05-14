import {
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/config/firebase'
import { COLLECTIONS } from '@/config/constants'

/**
 * Auth Service — decoupled authentication logic
 * Profile sync is handled by AuthContext via ensureUserProfile
 */

const LOG_PREFIX = '[AuthService]'

/**
 * Login with email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function loginWithEmail(email, password) {
  console.log(`${LOG_PREFIX} 🔐 Attempting login for: ${email}`)

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    console.log(`${LOG_PREFIX} ✅ Firebase Auth login successful: ${credential.user.uid}`)

    // Activity log (non-blocking)
    logActivity(credential.user.uid, 'login', 'auth', {
      email: credential.user.email,
      loginAt: new Date().toISOString(),
    })

    return credential
  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ Login failed:`, error.code, error.message)

    // Map Firebase error codes to user-friendly messages
    const errorMessages = {
      'auth/user-not-found': 'No existe una cuenta con este correo',
      'auth/wrong-password': 'Contraseña incorrecta',
      'auth/invalid-email': 'Correo electrónico inválido',
      'auth/user-disabled': 'Esta cuenta ha sido deshabilitada',
      'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde',
      'auth/invalid-credential': 'Credenciales inválidas',
      'auth/network-request-failed': 'Error de red. Verifica tu conexión',
    }

    const userMessage = errorMessages[error.code] || `Error de autenticación: ${error.message}`
    const enhancedError = new Error(userMessage)
    enhancedError.code = error.code
    enhancedError.originalError = error
    throw enhancedError
  }
}

/**
 * Logout current user
 */
export async function logout() {
  const uid = auth.currentUser?.uid
  const email = auth.currentUser?.email

  console.log(`${LOG_PREFIX} 🚪 Logging out: ${email || 'unknown'}`)

  if (uid) {
    logActivity(uid, 'logout', 'auth', {
      logoutAt: new Date().toISOString(),
    })
  }

  await signOut(auth)
  console.log(`${LOG_PREFIX} ✅ Logout successful`)
}

/**
 * Update user display name
 * @param {string} displayName
 */
export async function updateDisplayName(displayName) {
  if (!auth.currentUser) throw new Error('No authenticated user')
  await updateProfile(auth.currentUser, { displayName })
  console.log(`${LOG_PREFIX} Display name updated to: ${displayName}`)
}

/**
 * Log activity to Firestore for audit trail
 * Non-blocking — failures are logged but don't interrupt flow
 * @param {string} userId
 * @param {string} action
 * @param {string} module
 * @param {object} details
 */
export async function logActivity(userId, action, module, details = {}) {
  try {
    const logId = `${userId}_${Date.now()}`
    const logRef = doc(db, COLLECTIONS.ACTIVITY_LOGS, logId)
    await setDoc(logRef, {
      userId,
      action,
      module,
      details,
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(), // Immediate timestamp for debugging
    })
    console.log(`${LOG_PREFIX} 📝 Activity logged: ${action} (${module})`)
  } catch (error) {
    // Non-blocking — don't break auth flow for log failures
    console.warn(`${LOG_PREFIX} ⚠ Activity log failed (non-blocking):`, error.message)
  }
}
