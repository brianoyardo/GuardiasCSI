import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS, USER_STATUS } from '@/config/constants'
import { ROLES } from '@/config/roles'

/**
 * User Service — Firestore profile management
 * Handles user profile CRUD and Auth ↔ Firestore sync
 */

const LOG_PREFIX = '[UserService]'

/**
 * Get user profile from Firestore
 * @param {string} uid - Firebase Auth UID
 * @returns {Promise<object|null>} User profile or null
 */
export async function getUserProfile(uid) {
  try {
    console.log(`${LOG_PREFIX} Fetching profile for uid: ${uid}`)
    const userRef = doc(db, COLLECTIONS.USERS, uid)
    const userSnap = await getDoc(userRef)

    if (userSnap.exists()) {
      const profile = { id: userSnap.id, ...userSnap.data() }
      console.log(`${LOG_PREFIX} Profile found:`, {
        uid: profile.id,
        email: profile.email,
        role: profile.role,
        status: profile.status,
      })
      return profile
    }

    console.log(`${LOG_PREFIX} No profile found for uid: ${uid}`)
    return null
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching profile:`, error)
    throw error
  }
}

/**
 * Create user profile in Firestore
 * Called when Auth user exists but Firestore profile doesn't
 * @param {import('firebase/auth').User} firebaseUser
 * @param {object} [overrides] - Optional field overrides
 * @returns {Promise<object>} Created profile
 */
export async function createUserProfile(firebaseUser, overrides = {}) {
  const uid = firebaseUser.uid

  console.log(`${LOG_PREFIX} Creating Firestore profile for: ${firebaseUser.email}`)

  const profile = {
    uid,
    email: firebaseUser.email || '',
    fullName: firebaseUser.displayName || '',
    phone: firebaseUser.phoneNumber || '',
    photoURL: firebaseUser.photoURL || '',
    role: ROLES.GUARD, // Default role for new users
    status: USER_STATUS.ACTIVE,
    clientId: null,
    locationId: null,
    deviceToken: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    ...overrides, // Allow overriding defaults (e.g., for admin seeding)
  }

  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid)
    await setDoc(userRef, profile)

    console.log(`${LOG_PREFIX} ✅ Profile created successfully:`, {
      uid,
      email: profile.email,
      role: profile.role,
    })

    // Return with resolved ID
    return { id: uid, ...profile }
  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ Error creating profile:`, error)
    throw error
  }
}

/**
 * Update lastLogin timestamp for existing user
 * @param {string} uid
 */
export async function updateLastLogin(uid) {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid)
    await updateDoc(userRef, {
      lastLogin: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    console.log(`${LOG_PREFIX} LastLogin updated for: ${uid}`)
  } catch (error) {
    // Non-blocking
    console.warn(`${LOG_PREFIX} Failed to update lastLogin:`, error)
  }
}

/**
 * Ensure user profile exists in Firestore
 * Creates it if missing, updates lastLogin if exists
 * This is the main sync point between Firebase Auth and Firestore
 * @param {import('firebase/auth').User} firebaseUser
 * @returns {Promise<object>} User profile
 */
export async function ensureUserProfile(firebaseUser) {
  console.log(`${LOG_PREFIX} 🔄 Syncing Auth → Firestore for: ${firebaseUser.email}`)

  const existingProfile = await getUserProfile(firebaseUser.uid)

  if (existingProfile) {
    // Profile exists — update lastLogin
    await updateLastLogin(firebaseUser.uid)

    // Validate profile has required fields
    const validatedProfile = validateProfile(existingProfile)
    return validatedProfile
  }

  // Profile doesn't exist — create it
  console.log(`${LOG_PREFIX} ⚠ No Firestore profile found. Auto-creating...`)
  const newProfile = await createUserProfile(firebaseUser)
  return newProfile
}

/**
 * Validate that a profile has all required fields
 * Fills in missing fields with defaults
 * @param {object} profile
 * @returns {object} Validated profile
 */
function validateProfile(profile) {
  const defaults = {
    role: ROLES.GUARD,
    status: USER_STATUS.ACTIVE,
    fullName: '',
    phone: '',
    photoURL: '',
    clientId: null,
    locationId: null,
    deviceToken: null,
  }

  const validated = { ...defaults, ...profile }

  // Check for critical missing fields
  if (!validated.role) {
    console.warn(`${LOG_PREFIX} ⚠ Profile missing role, defaulting to guard`)
    validated.role = ROLES.GUARD
  }

  if (!validated.status) {
    console.warn(`${LOG_PREFIX} ⚠ Profile missing status, defaulting to active`)
    validated.status = USER_STATUS.ACTIVE
  }

  return validated
}

/**
 * Update user profile fields
 * @param {string} uid
 * @param {object} fields
 */
export async function updateUserProfile(uid, fields) {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid)
    await updateDoc(userRef, {
      ...fields,
      updatedAt: serverTimestamp(),
    })
    console.log(`${LOG_PREFIX} Profile updated for: ${uid}`, Object.keys(fields))
  } catch (error) {
    console.error(`${LOG_PREFIX} Error updating profile:`, error)
    throw error
  }
}

/**
 * Get all users (admin function)
 * @param {object} [filters]
 * @returns {Promise<object[]>}
 */
export async function getAllUsers(filters = {}) {
  try {
    let q = collection(db, COLLECTIONS.USERS)

    if (filters.role) {
      q = query(q, where('role', '==', filters.role))
    }

    if (filters.status) {
      q = query(q, where('status', '==', filters.status))
    }

    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching users:`, error)
    throw error
  }
}
