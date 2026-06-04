import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, serverTimestamp, onSnapshot,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS } from '@/config/constants'
import { RONDA_STATES } from '@/modules/rondas/stateMachine/rondaStateMachine'
import { getUserProfile } from '@/modules/users/services/userService'
import { getRoute, getGeofences } from '@/modules/spatial/services/spatialService'

/**
 * SentinelOps — Ronda Assignment Service
 * Manages the assignment of rondas to guards
 * 
 * An Assignment links a Ronda definition to a Guard with:
 *   - Scheduled time window
 *   - Priority
 *   - Status tracking
 */

const LOG_PREFIX = '[AssignmentService]'

/**
 * Get a single assignment by ID
 * @param {string} assignmentId
 * @returns {Promise<object|null>}
 */
export async function getAssignment(assignmentId) {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.RONDA_ASSIGNMENTS, assignmentId))
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching assignment ${assignmentId}:`, error)
    return null
  }
}

/**
 * Get assignments for a specific guard
 * @param {string} guardId
 * @param {object} [filters] - { status, date }
 * @returns {Promise<object[]>}
 */
export async function getGuardAssignments(guardId, filters = {}) {
  try {
    let constraints = [where('guardId', '==', guardId)]

    if (filters.status) {
      constraints.push(where('status', '==', filters.status))
    }

    const q = query(
      collection(db, COLLECTIONS.RONDA_ASSIGNMENTS),
      ...constraints,
      orderBy('scheduledStart', 'desc')
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching guard assignments:`, error)
    throw error
  }
}

/**
 * Subscribe to assignments for a specific guard (real-time)
 * @param {string} guardId
 * @param {function} callback - Called with array of assignments on each update
 * @returns {function} Unsubscribe function
 */
export function subscribeToGuardAssignments(guardId, callback) {
  const q = query(
    collection(db, COLLECTIONS.RONDA_ASSIGNMENTS),
    where('guardId', '==', guardId),
    orderBy('scheduledStart', 'desc')
  )

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const assignments = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(assignments)
  }, (error) => {
    console.error(`${LOG_PREFIX} Error in guard assignments subscription:`, error)
  })

  return unsubscribe
}

/**
 * Subscribe to ALL assignments (admin/ops real-time view)
 * @param {function} callback - Called with array of assignments on each update
 * @returns {function} Unsubscribe function
 */
export function subscribeToAllAssignments(callback) {
  const q = query(
    collection(db, COLLECTIONS.RONDA_ASSIGNMENTS),
    orderBy('scheduledStart', 'desc')
  )

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const assignments = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(assignments)
  }, (error) => {
    console.error(`${LOG_PREFIX} Error in all assignments subscription:`, error)
  })

  return unsubscribe
}

/**
 * Get all assignments (admin/ops view)
 * @param {object} [filters]
 * @returns {Promise<object[]>}
 */
export async function getAllAssignments(filters = {}) {
  try {
    let constraints = []

    if (filters.status) {
      constraints.push(where('status', '==', filters.status))
    }
    if (filters.guardId) {
      constraints.push(where('guardId', '==', filters.guardId))
    }

    const q = query(
      collection(db, COLLECTIONS.RONDA_ASSIGNMENTS),
      ...constraints
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching all assignments:`, error)
    throw error
  }
}

/**
 * Create a new assignment
 * @param {object} data
 * @param {string} data.rondaId
 * @param {string} data.guardId
 * @param {string} data.routeId
 * @param {number} data.scheduledStart - Unix timestamp
 * @param {number} data.scheduledEnd - Unix timestamp
 * @param {string} data.assignedBy - UID of admin/ops who assigned
 * @param {string} [data.priority='normal'] - low | normal | high | urgent
 * @returns {Promise<string>}
 */
export async function createAssignment(data) {
  try {
    // ─── Anti-Lookup: Resolve denormalized names at write time ───
    let guardName = data.guardName || ''
    let guardCode = data.guardCode || ''
    let routeName = data.routeName || ''
    let geofenceName = data.geofenceName || ''

    if (!guardName || !guardCode) {
      try {
        const guardProfile = await getUserProfile(data.guardId)
        if (guardProfile) {
          guardName = guardProfile.fullName || guardProfile.email || ''
          guardCode = guardProfile.guardId || data.guardId?.slice(0, 6) || ''
        }
      } catch (_) { /* Non-blocking: proceed with empty strings */ }
    }

    if (!routeName && data.routeId) {
      try {
        const routeDoc = await getRoute(data.routeId)
        if (routeDoc) routeName = routeDoc.name || ''
      } catch (_) { /* Non-blocking */ }
    }

    if (!geofenceName && data.routeId) {
      try {
        const allGeofences = await getGeofences()
        const linked = allGeofences.find(g => g.routeId === data.routeId)
        if (linked) geofenceName = linked.name || ''
      } catch (_) { /* Non-blocking */ }
    }

    // Generate structured custom ID
    const guardCodeClean = guardCode || data.guardCode || 'guard'
    const assignId = `assignment_${guardCodeClean}_${Date.now()}`
    const assignRef = doc(db, COLLECTIONS.RONDA_ASSIGNMENTS, assignId)

    await setDoc(assignRef, {
      rondaId: data.rondaId,
      guardId: data.guardId,
      guardName,
      guardCode,
      routeId: data.routeId,
      routeName,
      geofenceName,
      scheduledStart: data.scheduledStart,
      scheduledEnd: data.scheduledEnd,
      assignedBy: data.assignedBy,
      priority: data.priority || 'normal',
      status: RONDA_STATES.AVAILABLE,
      executionId: null,
      notes: data.notes || '',
      strictTimeSync: data.strictTimeSync !== undefined ? data.strictTimeSync : true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // console.log(`${LOG_PREFIX} ✅ Assignment created: ${assignRef.id} → Guard ${guardCode}`)
    return assignRef.id
  } catch (error) {
    console.error(`${LOG_PREFIX} Error creating assignment:`, error)
    throw error
  }
}

/**
 * Update assignment status
 * @param {string} assignmentId
 * @param {string} status
 * @param {object} [extraFields]
 */
export async function updateAssignmentStatus(assignmentId, status, extraFields = {}) {
  try {
    await updateDoc(doc(db, COLLECTIONS.RONDA_ASSIGNMENTS, assignmentId), {
      status,
      ...extraFields,
      updatedAt: serverTimestamp(),
    })
    // console.log(`${LOG_PREFIX} Assignment ${assignmentId} → ${status}`)
  } catch (error) {
    console.error(`${LOG_PREFIX} Error updating assignment:`, error)
    throw error
  }
}
