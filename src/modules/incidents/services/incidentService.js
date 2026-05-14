import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS } from '@/config/constants'

/**
 * SentinelOps — Incident Service
 * Manages incident lifecycle: create, assign, investigate, resolve
 * 
 * Incidents are geolocated operational events.
 * Multimedia evidence is stored via Appwrite (separate service).
 */

const LOG_PREFIX = '[IncidentService]'

/**
 * Create a new incident
 * @param {object} data
 * @param {string} data.title
 * @param {string} data.description
 * @param {string} data.type - security | maintenance | emergency | observation
 * @param {string} data.severity - low | medium | high | critical
 * @param {string} data.reportedBy - UID
 * @param {{ lat: number, lng: number }} [data.location]
 * @param {string[]} [data.evidenceIds] - Appwrite file IDs
 * @returns {Promise<string>}
 */
export async function createIncident(data) {
  try {
    const ref = doc(collection(db, COLLECTIONS.INCIDENTS))
    await setDoc(ref, {
      title: data.title,
      description: data.description || '',
      type: data.type,
      severity: data.severity,
      status: 'open',
      reportedBy: data.reportedBy,
      assignedTo: null,
      location: data.location || null,
      evidenceIds: data.evidenceIds || [],
      resolution: null,
      resolvedBy: null,
      resolvedAt: null,
      tags: data.tags || [],
      rondaId: data.rondaId || null,
      executionId: data.executionId || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    console.log(`${LOG_PREFIX} ✅ Incident created: ${ref.id}`)
    return ref.id
  } catch (error) {
    console.error(`${LOG_PREFIX} Error creating incident:`, error)
    throw error
  }
}

/**
 * Update incident status
 * @param {string} incidentId
 * @param {string} status - open | investigating | escalated | resolved | closed
 * @param {object} [extras] - { assignedTo, resolution, resolvedBy }
 */
export async function updateIncidentStatus(incidentId, status, extras = {}) {
  try {
    const updates = {
      status,
      ...extras,
      updatedAt: serverTimestamp(),
    }

    if (status === 'resolved' || status === 'closed') {
      updates.resolvedAt = serverTimestamp()
    }

    await updateDoc(doc(db, COLLECTIONS.INCIDENTS, incidentId), updates)
    console.log(`${LOG_PREFIX} Incident ${incidentId} → ${status}`)
  } catch (error) {
    console.error(`${LOG_PREFIX} Error updating incident:`, error)
    throw error
  }
}

/**
 * Get incidents with filters
 * @param {object} [filters]
 * @returns {Promise<object[]>}
 */
export async function getIncidents(filters = {}) {
  try {
    let constraints = []

    if (filters.status) constraints.push(where('status', '==', filters.status))
    if (filters.severity) constraints.push(where('severity', '==', filters.severity))
    if (filters.type) constraints.push(where('type', '==', filters.type))
    if (filters.reportedBy) constraints.push(where('reportedBy', '==', filters.reportedBy))

    const q = query(collection(db, COLLECTIONS.INCIDENTS), ...constraints)
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching incidents:`, error)
    throw error
  }
}

/**
 * Get single incident
 */
export async function getIncident(incidentId) {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.INCIDENTS, incidentId))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching incident:`, error)
    throw error
  }
}
