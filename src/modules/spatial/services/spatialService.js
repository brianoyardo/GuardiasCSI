import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, serverTimestamp, deleteDoc
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { SPATIAL_COLLECTIONS } from '../constants/spatialCollections'
import { normalizeGeometry, sanitizeForFirestore } from '../utils/geoJsonUtils'

/**
 * SentinelOps — Spatial Service
 * Manages spatial entities (Routes, Checkpoints, Geofences)
 * with versioning and audit trails.
 * 
 * Semantic ID format:
 *   Geofences:   GEO-EMPRESA-PIL
 *   Routes:      RUTA-EMPRESA-PIL-NORTE
 *   Checkpoints: CP-EMPRESA-PIL-NORTE-01
 */

const LOG_PREFIX = '[SpatialService]'

/**
 * Generate a semantic document ID from a name string.
 * Sanitizes to uppercase, removes special chars, replaces spaces with hyphens.
 * @param {string} prefix - 'GEO' | 'RUTA' | 'CP'
 * @param {string} name - Human-readable name
 * @param {string} [suffix] - Optional suffix (e.g. order number)
 * @returns {string} Semantic ID (e.g. 'GEO-EMPRESA-PIL')
 */
function generateSemanticId(prefix, name, suffix = '') {
  const sanitized = name
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^A-Z0-9\s-]/g, '') // Keep only alphanumeric, spaces, hyphens
    .replace(/\s+/g, '-')          // Spaces → hyphens
    .replace(/-+/g, '-')           // Collapse multiple hyphens
    .replace(/^-|-$/g, '')         // Trim leading/trailing hyphens
  const base = `${prefix}-${sanitized}`
  return suffix ? `${base}-${suffix}` : base
}
/**
 * Generic save function for spatial entities
 */
async function saveSpatialEntity(collectionName, entityId, data, userId) {
  if (!collectionName) {
    // console.warn(`${LOG_PREFIX} Missing collectionName during save operation`);
    throw new Error('collectionName is required');
  }

  try {
    const ref = entityId 
      ? doc(db, collectionName, entityId) 
      : doc(collection(db, collectionName))
      
    const isNew = !entityId

    const payload = {
      ...data,
      geometry: sanitizeForFirestore(data.geometry),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
      geometryVersion: isNew ? 1 : (data.geometryVersion || 1) + 1,
    }

    if (isNew) {
      payload.createdAt = serverTimestamp()
      payload.createdBy = userId
    }

    await setDoc(ref, payload, { merge: true })
    // console.log(`${LOG_PREFIX} ✅ Saved ${collectionName}: ${ref.id} (v${payload.geometryVersion})`)
    return ref.id
  } catch (error) {
    console.error(`${LOG_PREFIX} Error saving ${collectionName}:`, error)
    throw error
  }
}

function deserializeGeometry(geometry) {
  if (!geometry || !geometry.coordinatesFirestore) return geometry
  
  let coordinates
  if (geometry.type === 'LineString') {
    coordinates = geometry.coordinatesFirestore.map(c => [c.lng, c.lat])
  } else if (geometry.type === 'Polygon') {
    coordinates = [geometry.coordinatesFirestore.map(c => [c.lng, c.lat])]
  } else if (geometry.type === 'Point') {
    coordinates = [geometry.coordinatesFirestore.lng, geometry.coordinatesFirestore.lat]
  }
  
  return {
    ...geometry,
    coordinates
  }
}

/**
 * Generic fetch function for spatial entities
 */
async function getSpatialEntities(collectionName, activeOnly = false) {
  if (!collectionName) {
    // console.warn(`${LOG_PREFIX} getSpatialEntities called with undefined/empty collectionName. Returning []`);
    return [];
  }

  try {
    let q = collection(db, collectionName)
    if (activeOnly) {
      q = query(q, where('status', '==', 'active'))
    }
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => {
      const data = d.data()
      if (data.geometry) data.geometry = deserializeGeometry(data.geometry)
      return { id: d.id, ...data }
    })
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching ${collectionName}:`, error)
    return []; // Return empty array on failure to prevent crashing UI
  }
}

/**
 * Routes (LineStrings)
 * Semantic ID format: RUTA-{GEOFENCE-CONTEXT}-{NAME}
 */
export async function saveRoute(id, data, userId) {
  // Generate semantic ID for new routes
  const effectiveId = id || generateSemanticId('RUTA', data.name)
  return saveSpatialEntity(SPATIAL_COLLECTIONS.ROUTES, effectiveId, {
    name: data.name,
    description: data.description || '',
    status: data.status || 'active',
    geometry: data.geometry, // Expected LineString
    ...data
  }, userId)
}

export async function getRoutes(activeOnly = false) {
  return getSpatialEntities(SPATIAL_COLLECTIONS.ROUTES, activeOnly)
}

export async function getRoute(id) {
  try {
    const snap = await getDoc(doc(db, SPATIAL_COLLECTIONS.ROUTES, id))
    if (!snap.exists()) return null
    const data = snap.data()
    if (data.geometry) data.geometry = deserializeGeometry(data.geometry)
    return { id: snap.id, ...data }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching route ${id}:`, error)
    return null
  }
}

/**
 * Checkpoints (Points)
 * Semantic ID format: CP-{ROUTE-NAME}-{ORDER}
 */
export async function saveCheckpoint(id, data, userId) {
  // Generate semantic ID for new checkpoints
  let effectiveId = id
  if (!effectiveId) {
    const routeLabel = data.routeId || 'UNLINKED'
    const orderStr = String(data.order || 0).padStart(2, '0')
    // Try to get route name for a better ID
    let routeNameForId = routeLabel
    if (data.routeId) {
      try {
        const routeDoc = await getRoute(data.routeId)
        if (routeDoc?.name) routeNameForId = routeDoc.name
      } catch (_) { /* fallback to routeId */ }
    }
    effectiveId = generateSemanticId('CP', routeNameForId, orderStr)
  }
  return saveSpatialEntity(SPATIAL_COLLECTIONS.CHECKPOINTS, effectiveId, {
    name: data.name,
    description: data.description || '',
    status: data.status || 'active',
    qrCode: data.qrCode || null,
    radius: data.radius || 50,
    geometry: data.geometry,
    routeId: data.routeId || null,
    order: typeof data.order === 'number' ? data.order : 0,
    ...data
  }, userId)
}

export async function getCheckpoints(activeOnly = false) {
  return getSpatialEntities(SPATIAL_COLLECTIONS.CHECKPOINTS, activeOnly)
}

/**
 * Get checkpoints belonging to a specific route, ordered by sequence
 * @param {string} routeId
 * @returns {Promise<object[]>}
 */
export async function getCheckpointsByRoute(routeId) {
  try {
    const q = query(
      collection(db, SPATIAL_COLLECTIONS.CHECKPOINTS),
      where('routeId', '==', routeId),
      orderBy('order', 'asc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => {
      const data = d.data()
      if (data.geometry) data.geometry = deserializeGeometry(data.geometry)
      return { id: d.id, ...data }
    })
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching checkpoints for route ${routeId}:`, error)
    return []
  }
}

/**
 * Geofences (Polygons)
 * Semantic ID format: GEO-{NAME}
 */
export async function saveGeofence(id, data, userId) {
  // Generate semantic ID for new geofences
  const effectiveId = id || generateSemanticId('GEO', data.name)
  return saveSpatialEntity(SPATIAL_COLLECTIONS.GEOFENCES, effectiveId, {
    name: data.name,
    type: data.type || 'restricted',
    status: data.status || 'active',
    geometry: data.geometry,
    routeId: data.routeId || null,
    ...data
  }, userId)
}

export async function getGeofences(activeOnly = false) {
  return getSpatialEntities(SPATIAL_COLLECTIONS.GEOFENCES, activeOnly)
}

/**
 * Delete entity (Soft delete recommended, but hard delete implemented for editor flexibility)
 */
export async function deleteSpatialEntity(collectionName, id) {
  await deleteDoc(doc(db, collectionName, id))
  // console.log(`${LOG_PREFIX} 🗑 Deleted ${collectionName}: ${id}`)
}
