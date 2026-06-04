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
  onSnapshot,
  orderBy,
  deleteDoc,
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
    // 1. Try direct lookup (Admin/Supervisor/Ops Chief, or Guard Pointer)
    const userRef = doc(db, COLLECTIONS.USERS, uid)
    const userSnap = await getDoc(userRef)

    if (userSnap.exists()) {
      const data = userSnap.data()
      if (data.isPointer && data.guardId) {
        // Fetch the actual guard profile
        const guardRef = doc(db, COLLECTIONS.USERS, data.guardId)
        const guardSnap = await getDoc(guardRef)
        if (guardSnap.exists()) {
          return { id: guardSnap.id, ...guardSnap.data() }
        }
      }
      return { id: userSnap.id, ...data }
    }

    // 2. Query fallback (Guards with guardId doc IDs, or self-healing missing pointer)
    const q = query(collection(db, COLLECTIONS.USERS), where('uid', '==', uid))
    const querySnap = await getDocs(q)
    if (!querySnap.empty) {
      // Find the first document that is not a pointer
      const nonPointer = querySnap.docs.find(d => !d.data().isPointer)
      if (nonPointer) {
        const docData = nonPointer.data()
        // Self-healing: if the user does not have a pointer doc under their uid, write it now!
        if (docData.guardId) {
          const pointerRef = doc(db, COLLECTIONS.USERS, uid)
          const pointerProfile = {
            uid,
            email: docData.email || '',
            fullName: docData.fullName || '',
            role: docData.role || ROLES.GUARD,
            status: docData.status || USER_STATUS.ACTIVE,
            guardId: docData.guardId,
            isPointer: true,
            createdAt: docData.createdAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
          }
          await setDoc(pointerRef, pointerProfile).catch(err => {
            console.warn(`${LOG_PREFIX} Self-healing pointer creation failed:`, err)
          })
        }
        return { id: nonPointer.id, ...docData }
      }
      const docSnap = querySnap.docs[0]
      return { id: docSnap.id, ...docSnap.data() }
    }

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

  // console.log(`${LOG_PREFIX} Creating Firestore profile for: ${firebaseUser.email}`)

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
    // Biometría de Voz — Catar Seguridad Integral
    voiceProfileId: null,     // Azure Speech / IA voice profile ID
    biometricEnrolled: false, // Whether guard has completed voice enrollment
    voicePassphrase: null,    // Assigned passphrase for voice verification
    shiftStart: null,
    shiftEnd: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    ...overrides, // Allow overriding defaults (e.g., for admin seeding)
  }

  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid)
    await setDoc(userRef, profile)

    // console.log(`${LOG_PREFIX} ✅ Profile created successfully:`, {
    //   uid,
    //   email: profile.email,
    //   role: profile.role,
    // })

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
    const profile = await getUserProfile(uid)
    if (!profile) return

    const userRef = doc(db, COLLECTIONS.USERS, profile.id)
    await updateDoc(userRef, {
      lastLogin: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    // Non-blocking
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
  // console.log(`${LOG_PREFIX} 🔄 Syncing Auth → Firestore for: ${firebaseUser.email}`)

  const existingProfile = await getUserProfile(firebaseUser.uid)

  if (existingProfile) {
    // Profile exists — update lastLogin
    await updateLastLogin(firebaseUser.uid)

    // Validate profile has required fields
    const validatedProfile = validateProfile(existingProfile)
    return validatedProfile
  }

  // Profile doesn't exist — create it
  // console.log(`${LOG_PREFIX} ⚠ No Firestore profile found. Auto-creating...`)
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
    voiceProfileId: null,
    biometricEnrolled: false,
    voicePassphrase: null,
    shiftStart: null,
    shiftEnd: null,
  }

  const validated = { ...defaults, ...profile }

  // Check for critical missing fields
  if (!validated.role) {
    // console.warn(`${LOG_PREFIX} ⚠ Profile missing role, defaulting to guard`)
    validated.role = ROLES.GUARD
  }

  if (!validated.status) {
    // console.warn(`${LOG_PREFIX} ⚠ Profile missing status, defaulting to active`)
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
    const profile = await getUserProfile(uid)
    const docId = profile ? profile.id : uid

    const userRef = doc(db, COLLECTIONS.USERS, docId)
    await updateDoc(userRef, {
      ...fields,
      updatedAt: serverTimestamp(),
    })
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

/**
 * ─── Biometría de Voz — Catar Seguridad Integral ───
 */

/**
 * Enroll a guard's voice profile
 * @param {string} uid
 * @param {object} voiceData
 * @param {string} voiceData.voiceProfileId - Azure/IA voice profile ID
 * @param {string} voiceData.voicePassphrase - Assigned passphrase
 * @returns {Promise<void>}
 */
export async function enrollVoiceProfile(uid, voiceData) {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid)
    await updateDoc(userRef, {
      voiceProfileId: voiceData.voiceProfileId,
      voicePassphrase: voiceData.voicePassphrase,
      biometricEnrolled: true,
      updatedAt: serverTimestamp(),
    })
    // console.log(`${LOG_PREFIX} 🎤 Voice profile enrolled for: ${uid}`)
  } catch (error) {
    console.error(`${LOG_PREFIX} Error enrolling voice profile:`, error)
    throw error
  }
}

/**
 * Update voice verification result for a guard
 * @param {string} uid
 * @param {object} voiceResult
 * @param {number} voiceResult.matchScore - Confidence score (0-1)
 * @param {boolean} voiceResult.verified - Whether verification passed
 * @returns {Promise<void>}
 */
export async function updateVoiceVerification(uid, voiceResult) {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid)
    await updateDoc(userRef, {
      lastVoiceScore: voiceResult.matchScore,
      lastVoiceVerified: voiceResult.verified,
      lastVoiceVerifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    // console.log(`${LOG_PREFIX} 🎤 Voice verification updated for: ${uid} (score: ${voiceResult.matchScore})`)
  } catch (error) {
    console.error(`${LOG_PREFIX} Error updating voice verification:`, error)
    throw error
  }
}

/**
 * Get guards eligible for voice verification (enrolled and active)
 * @returns {Promise<object[]>}
 */
export async function getVoiceEnrolledGuards() {
  try {
    const q = query(
      collection(db, COLLECTIONS.USERS),
      where('biometricEnrolled', '==', true),
      where('status', '==', USER_STATUS.ACTIVE)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching voice-enrolled guards:`, error)
    throw error
  }
}

/**
 * ─── Admin User Management (Secondary App) ───
 * Creates users via a secondary Firebase App to avoid
 * logging out the current admin session.
 */

/**
 * Create a user in Firebase Auth + Firestore using a secondary app
 * @param {object} data
 * @param {string} data.email
 * @param {string} data.password
 * @param {string} data.fullName
 * @param {string} data.role - ROLES.ADMIN | ROLES.OPERATIONS_CHIEF | ROLES.SUPERVISOR | ROLES.GUARD
 * @param {string} [data.phone]
 * @param {string} [data.guardId] - e.g. 'G-006'
 * @returns {Promise<object>} Created user profile
 */
export async function adminCreateUser(data) {
  const { email, password, fullName, role = ROLES.GUARD, phone = '', guardId = '', shiftStart = null, shiftEnd = null } = data

  // Dynamic import to avoid SSR issues
  const { initializeApp: initApp, deleteApp } = await import('firebase/app')
  const { getAuth, createUserWithEmailAndPassword } = await import('firebase/auth')

  // Same config as primary app
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }

  let secondaryApp
  let secondaryAuth
  let createdUid = null

  try {
    // 0. Check if guardId already taken in Firestore
    if (guardId) {
      const q = query(collection(db, COLLECTIONS.USERS), where('guardId', '==', guardId))
      const snap = await getDocs(q)
      if (!snap.empty) {
        throw new Error(`El código de guardia "${guardId}" ya está asignado a otro usuario.`)
      }
    }

    // 1. Create secondary app
    secondaryApp = initApp(firebaseConfig, 'SecondaryApp_' + Date.now())
    secondaryAuth = getAuth(secondaryApp)

    // 2. Create Auth user
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    createdUid = userCredential.user.uid

    // 3. Create Firestore profile
    const docId = guardId || createdUid
    const userRef = doc(db, COLLECTIONS.USERS, docId)
    const profile = {
      uid: createdUid,
      email,
      fullName,
      phone,
      photoURL: '',
      role,
      status: USER_STATUS.ACTIVE,
      clientId: null,
      locationId: null,
      deviceToken: null,
      voiceProfileId: null,
      biometricEnrolled: false,
      voicePassphrase: null,
      guardId: guardId || null,
      shiftStart: shiftStart || null,
      shiftEnd: shiftEnd || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLogin: null,
    }

    await setDoc(userRef, profile)

    // Write pointer document for rules & login mapping
    if (guardId) {
      const pointerRef = doc(db, COLLECTIONS.USERS, createdUid)
      const pointerProfile = {
        uid: createdUid,
        email,
        fullName,
        role,
        status: USER_STATUS.ACTIVE,
        guardId,
        isPointer: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      await setDoc(pointerRef, pointerProfile)
    }

    // console.log(`${LOG_PREFIX} ✅ User created: ${email} (${role})`)
    return { id: docId, ...profile }
  } catch (error) {
    // Cleanup Auth user if Firestore creation failed
    if (createdUid && secondaryAuth) {
      try {
        await secondaryAuth.currentUser?.delete()
      } catch (_) {
        // Ignore cleanup errors
      }
    }
    console.error(`${LOG_PREFIX} ❌ Error creating user:`, error)
    throw error
  } finally {
    // 4. Sign out and delete secondary app
    if (secondaryAuth) {
      try {
        await secondaryAuth.signOut()
      } catch (_) {}
    }
    if (secondaryApp) {
      try {
        deleteApp(secondaryApp)
      } catch (_) {}
    }
  }
}

/**
 * Update user role
 * @param {string} uid
 * @param {string} newRole
 */
export async function updateUserRole(uid, newRole) {
  const userRef = doc(db, COLLECTIONS.USERS, uid)
  await updateDoc(userRef, {
    role: newRole,
    updatedAt: serverTimestamp(),
  })
  // console.log(`${LOG_PREFIX} Role updated for ${uid} → ${newRole}`)
}

/**
 * Toggle user status (active ↔ inactive)
 * @param {string} uid
 * @param {string} currentStatus
 */
export async function toggleUserStatus(uid, currentStatus) {
  const newStatus = currentStatus === USER_STATUS.ACTIVE ? USER_STATUS.INACTIVE : USER_STATUS.ACTIVE
  const userRef = doc(db, COLLECTIONS.USERS, uid)
  await updateDoc(userRef, {
    status: newStatus,
    updatedAt: serverTimestamp(),
  })
  
  if (newStatus === USER_STATUS.INACTIVE) {
    try {
      const assignmentsRef = collection(db, COLLECTIONS.RONDA_ASSIGNMENTS)
      const incompleteStates = ['pending', 'available', 'in_progress', 'paused', 'validating_voice']
      const q = query(
        assignmentsRef,
        where('guardId', '==', uid),
        where('status', 'in', incompleteStates)
      )
      const snap = await getDocs(q)
      if (!snap.empty) {
        const deletePromises = snap.docs.map((doc) => deleteDoc(doc.ref))
        await Promise.all(deletePromises)
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} Error clearing assignments:`, err)
    }
  }

  return newStatus
}

/**
 * Subscribe to users collection in real-time
 * @param {Function} callback - Called with array of users on each update
 * @returns {Function} Unsubscribe function
 */
export function subscribeToUsers(callback) {
  const q = query(
    collection(db, COLLECTIONS.USERS),
    orderBy('createdAt', 'desc')
  )

  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((u) => !u.isPointer)
    callback(users)
  }, (error) => {
    console.error(`${LOG_PREFIX} Users subscription error:`, error)
  })
}

/**
 * Update full user profile, migrating document if guardId changes
 * @param {string} oldDocId - Current Firestore document ID
 * @param {string} newGuardId - New Guard ID/Code (might be empty/null, or different)
 * @param {object} updateData - Object containing updated fields (fullName, phone, role, shiftStart, shiftEnd)
 */
export async function updateFullUserProfile(oldDocId, newGuardId, updateData) {
  try {
    // 1. Determine target document ID
    const targetDocId = newGuardId || updateData.uid || oldDocId

    // 2. If changing Guard ID, check uniqueness
    if (newGuardId && newGuardId !== oldDocId) {
      const q = query(
        collection(db, COLLECTIONS.USERS),
        where('guardId', '==', newGuardId)
      )
      const snap = await getDocs(q)
      if (!snap.empty) {
        throw new Error(`El código de guardia "${newGuardId}" ya está registrado por otro usuario.`)
      }
    }

    const oldRef = doc(db, COLLECTIONS.USERS, oldDocId)
    const oldSnap = await getDoc(oldRef)
    if (!oldSnap.exists()) {
      throw new Error(`El usuario a modificar no existe en la base de datos.`)
    }
    const oldData = oldSnap.data()
    const resolvedUid = oldData.uid || updateData.uid

    if (targetDocId === oldDocId) {
      // Direct update
      await updateDoc(oldRef, {
        ...updateData,
        guardId: newGuardId || null,
        updatedAt: serverTimestamp(),
      })
    } else {
      // Document migration required
      const mergedData = {
        ...oldData,
        ...updateData,
        guardId: newGuardId || null,
        updatedAt: serverTimestamp(),
      }

      const newRef = doc(db, COLLECTIONS.USERS, targetDocId)
      
      // Write new, then delete old
      await setDoc(newRef, mergedData)
      await deleteDoc(oldRef)
    }

    // 3. Update or create the pointer document at users/resolvedUid
    if (resolvedUid) {
      const pointerRef = doc(db, COLLECTIONS.USERS, resolvedUid)
      const pointerData = {
        uid: resolvedUid,
        email: oldData.email || updateData.email || '',
        fullName: updateData.fullName,
        role: updateData.role,
        status: oldData.status || USER_STATUS.ACTIVE,
        guardId: newGuardId || null,
        isPointer: true,
        updatedAt: serverTimestamp(),
      }
      await setDoc(pointerRef, pointerData, { merge: true })
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error in updateFullUserProfile:`, error)
    throw error
  }
}

