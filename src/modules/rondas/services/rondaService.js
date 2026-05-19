import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS } from '@/config/constants'

/**
 * SentinelOps — Ronda Definition Service
 * CRUD for ronda templates/definitions (admin-facing)
 * 
 * A "Ronda" is a patrol definition:
 *   - Which route to follow
 *   - Which checkpoints to visit
 *   - Time constraints
 *   - Priority
 * 
 * Assignments and Executions are separate entities.
 */

const LOG_PREFIX = '[RondaService]'

/**
 * Get all ronda definitions
 * @param {object} [filters]
 * @returns {Promise<object[]>}
 */
export async function getRondas(filters = {}) {
  try {
    let q = collection(db, COLLECTIONS.RONDAS)

    if (filters.routeId) {
      q = query(q, where('routeId', '==', filters.routeId))
    }

    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching rondas:`, error)
    throw error
  }
}

/**
 * Get a single ronda definition
 * @param {string} rondaId
 * @returns {Promise<object|null>}
 */
export async function getRonda(rondaId) {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.RONDAS, rondaId))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching ronda:`, error)
    throw error
  }
}

/**
 * Create a ronda definition
 * @param {object} rondaData
 * @returns {Promise<string>} Created ronda ID
 */
export async function createRonda(rondaData) {
  try {
    const rondaRef = doc(collection(db, COLLECTIONS.RONDAS))
    await setDoc(rondaRef, {
      ...rondaData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    // console.log(`${LOG_PREFIX} ✅ Ronda created: ${rondaRef.id}`)
    return rondaRef.id
  } catch (error) {
    console.error(`${LOG_PREFIX} Error creating ronda:`, error)
    throw error
  }
}

/**
 * Update a ronda definition
 * @param {string} rondaId
 * @param {object} fields
 */
export async function updateRonda(rondaId, fields) {
  try {
    await updateDoc(doc(db, COLLECTIONS.RONDAS, rondaId), {
      ...fields,
      updatedAt: serverTimestamp(),
    })
    // console.log(`${LOG_PREFIX} Updated: ${rondaId}`)
  } catch (error) {
    console.error(`${LOG_PREFIX} Error updating ronda:`, error)
    throw error
  }
}
