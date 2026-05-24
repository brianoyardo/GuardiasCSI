import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, serverTimestamp, onSnapshot,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS } from '@/config/constants'
import { getUserProfile } from '@/modules/users/services/userService'
import { getGeofences } from '@/modules/spatial/services/spatialService'

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

    // ─── Anti-Lookup: Resolve reporter identity at write time ───
    let guardName = data.guardName || ''
    let guardCode = data.guardCode || ''
    let routeName = data.routeName || ''
    let geofenceName = data.geofenceName || ''

    if ((!guardName || !guardCode) && data.reportedBy) {
      try {
        const guardProfile = await getUserProfile(data.reportedBy)
        if (guardProfile) {
          guardName = guardProfile.fullName || guardProfile.email || ''
          guardCode = guardProfile.guardId || data.reportedBy?.slice(0, 6) || ''
        }
      } catch (_) { /* Non-blocking */ }
    }

    if (!geofenceName && data.location) {
      try {
        const allGeofences = await getGeofences()
        // Simple proximity check — use routeId if available
        if (data.routeId) {
          const linked = allGeofences.find(g => g.routeId === data.routeId)
          if (linked) {
            geofenceName = linked.name || ''
            routeName = data.routeName || ''
          }
        }
      } catch (_) { /* Non-blocking */ }
    }

    await setDoc(ref, {
      title: data.title,
      description: data.description || '',
      type: data.type,
      severity: data.severity,
      status: 'open',
      reportedBy: data.reportedBy,
      // ─── Denormalized fields (Anti-Lookup) ───
      guardName,
      guardCode,
      routeName,
      geofenceName,
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
    // console.log(`${LOG_PREFIX} ✅ Incident created: ${ref.id}`)
    return ref.id
  } catch (error) {
    console.error(`${LOG_PREFIX} Error creating incident:`, error)
    throw error
  }
}

/**
 * Create a panic incident directly (no form, no evidence upload)
 * Used by the global panic button in GuardLayout
 * 
 * @param {object} data
 * @param {string} data.guardId - UID del guardia
 * @param {{ lat: number, lng: number }} data.location - GPS coords
 * @param {string} [data.assignmentId] - Ronda activa (si aplica)
 * @param {string} [data.rondaId] - ID de la ronda
 * @returns {Promise<string>} Incident ID
 */
export async function createPanicIncident(data) {
  try {
    const ref = doc(collection(db, COLLECTIONS.INCIDENTS))

    // Resolve reporter identity at write time (Anti-Lookup)
    let guardName = data.guardName || ''
    let guardCode = data.guardCode || ''
    let routeName = data.routeName || ''
    let geofenceName = data.geofenceName || ''

    const reporterId = data.guardId || data.reportedBy
    if (reporterId) {
      try {
        const guardProfile = await getUserProfile(reporterId)
        if (guardProfile) {
          guardName = guardProfile.fullName || guardProfile.email || ''
          guardCode = guardProfile.guardId || reporterId.slice(0, 6) || ''
        }
      } catch (_) { /* Non-blocking */ }
    }

    await setDoc(ref, {
      title: '🚨 ¡BOTÓN DE PÁNICO ACTIVADO!',
      description: 'El guardia requiere asistencia inmediata. Activación de protocolo de emergencia.',
      type: 'emergency',
      severity: 'critical',
      status: 'open',
      reportedBy: reporterId,
      guardName,
      guardCode,
      routeName,
      geofenceName,
      assignedTo: null,
      location: data.location || null,
      evidenceIds: [],
      resolution: null,
      resolvedBy: null,
      resolvedAt: null,
      tags: ['panic', 'emergency', 'auto-reported'],
      rondaId: data.rondaId || null,
      executionId: data.executionId || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    // console.log(`${LOG_PREFIX} 🚨 PANIC INCIDENT created: ${ref.id}`)
    return ref.id
  } catch (error) {
    console.error(`${LOG_PREFIX} Error creating panic incident:`, error)
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
    // console.log(`${LOG_PREFIX} Incident ${incidentId} → ${status}`)
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

/**
 * Subscribe to active incidents (open or in_progress) in real time
 * @param {function} callback - receives array of incident objects
 * @returns {function} unsubscribe
 */
export function subscribeToActiveIncidents(callback) {
  try {
    const q = query(
      collection(db, COLLECTIONS.INCIDENTS),
      where('status', 'in', ['open', 'in_progress'])
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const incidents = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      callback(incidents)
    }, (error) => {
      console.error(`${LOG_PREFIX} Error subscribing to active incidents:`, error)
      callback([])
    })
    return unsubscribe
  } catch (error) {
    console.error(`${LOG_PREFIX} Error setting up incident subscription:`, error)
    return () => {}
  }
}
