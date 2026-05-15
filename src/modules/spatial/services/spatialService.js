import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, serverTimestamp, deleteDoc
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { SPATIAL_COLLECTIONS } from '../constants/spatialCollections'
import { normalizeGeometry } from '../utils/geoJsonUtils'

/**
 * SentinelOps — Spatial Service
 * Manages spatial entities (Routes, Checkpoints, Geofences)
 * with versioning and audit trails.
 */

const LOG_PREFIX = '[SpatialService]'

/**
 * Generic save function for spatial entities
 */
async function saveSpatialEntity(collectionName, entityId, data, userId) {
  if (!collectionName) {
    console.warn(`${LOG_PREFIX} Missing collectionName during save operation`);
    throw new Error('collectionName is required');
  }

  try {
    const ref = entityId 
      ? doc(db, collectionName, entityId) 
      : doc(collection(db, collectionName))
      
    const isNew = !entityId

    const payload = {
      ...data,
      geometry: normalizeGeometry(data.geometry),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
      geometryVersion: isNew ? 1 : (data.geometryVersion || 1) + 1,
    }

    if (isNew) {
      payload.createdAt = serverTimestamp()
      payload.createdBy = userId
    }

    await setDoc(ref, payload, { merge: true })
    console.log(`${LOG_PREFIX} ✅ Saved ${collectionName}: ${ref.id} (v${payload.geometryVersion})`)
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
    console.warn(`${LOG_PREFIX} getSpatialEntities called with undefined/empty collectionName. Returning []`);
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
 */
export async function saveRoute(id, data, userId) {
  return saveSpatialEntity(SPATIAL_COLLECTIONS.ROUTES, id, {
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
 */
export async function saveCheckpoint(id, data, userId) {
  return saveSpatialEntity(SPATIAL_COLLECTIONS.CHECKPOINTS, id, {
    name: data.name,
    description: data.description || '',
    status: data.status || 'active',
    qrCode: data.qrCode || null,
    radius: data.radius || 50, // Validation radius in meters
    geometry: data.geometry, // Expected Point
    ...data
  }, userId)
}

export async function getCheckpoints(activeOnly = false) {
  return getSpatialEntities(SPATIAL_COLLECTIONS.CHECKPOINTS, activeOnly)
}

/**
 * Geofences (Polygons)
 */
export async function saveGeofence(id, data, userId) {
  return saveSpatialEntity(SPATIAL_COLLECTIONS.GEOFENCES, id, {
    name: data.name,
    type: data.type || 'restricted', // restricted | patrol | warning
    status: data.status || 'active',
    geometry: data.geometry, // Expected Polygon
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
  console.log(`${LOG_PREFIX} 🗑 Deleted ${collectionName}: ${id}`)
}
