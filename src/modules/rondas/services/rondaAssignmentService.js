import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, serverTimestamp, onSnapshot,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS } from '@/config/constants'
import { RONDA_STATES } from '@/modules/rondas/stateMachine/rondaStateMachine'

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
    const assignRef = doc(collection(db, COLLECTIONS.RONDA_ASSIGNMENTS))

    await setDoc(assignRef, {
      rondaId: data.rondaId,
      guardId: data.guardId,
      routeId: data.routeId,
      scheduledStart: data.scheduledStart,
      scheduledEnd: data.scheduledEnd,
      assignedBy: data.assignedBy,
      priority: data.priority || 'normal',
      status: RONDA_STATES.AVAILABLE,
      executionId: null,
      notes: data.notes || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // console.log(`${LOG_PREFIX} ✅ Assignment created: ${assignRef.id} → Guard ${data.guardId}`)
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
