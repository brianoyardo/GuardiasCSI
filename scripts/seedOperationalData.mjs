/**
 * SentinelOps — Operational Data Seeding (Fase 12.6)
 * 
 * Populates Firestore with realistic operational data for E2E validation.
 * Uses La Paz coordinates and Turf.js for GPS track simulation.
 * 
 * Usage: yarn seed:ops <admin_password>
 * 
 * IMPORTANT: This script authenticates as admin and stays authenticated
 * as admin throughout. Guard user profiles are created as Firestore
 * documents only (no Firebase Auth accounts) to avoid session switching.
 */

import { initializeApp } from 'firebase/app'
import {
  getFirestore, doc, setDoc, serverTimestamp,
  collection, getDocs, deleteDoc
} from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import * as turf from '@turf/turf'

// ─── Firebase Config ───
const firebaseConfig = {
  apiKey: "AIzaSyAes98Y-p_8M6lcRxoaPbC87GPLYkYKKBA",
  authDomain: "guardias-prueba.firebaseapp.com",
  projectId: "guardias-prueba",
  storageBucket: "guardias-prueba.firebasestorage.app",
  messagingSenderId: "693842246915",
  appId: "1:693842246915:web:5e7eb2f598dc7031397d36",
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)

const ADMIN_EMAIL = 'manchas@gmail.com'
const ADMIN_PASSWORD = process.argv[2] || ''

if (!ADMIN_PASSWORD) {
  console.error('❌ Uso: yarn seed:ops <password>')
  process.exit(1)
}

// ─── Collections to wipe (NEVER touches users, roles, activityLogs) ───
const OPS_COLLECTIONS = [
  'routes', 'geofences', 'checkpoints', 'rondas',
  'rondaAssignments', 'checkpointLogs'
  // rondaExecutions handled separately due to subcollections
]

// ─── La Paz Geodata ───
const LP_ZONES = [
  {
    id: 'SOPOCACHI', name: 'Sopocachi',
    coords: [[-68.1270,-16.5100],[-68.1250,-16.5120],[-68.1220,-16.5110],[-68.1200,-16.5080],[-68.1230,-16.5050],[-68.1270,-16.5100]]
  },
  {
    id: 'OBRAJES', name: 'Obrajes',
    coords: [[-68.1060,-16.5270],[-68.1040,-16.5290],[-68.1020,-16.5280],[-68.1000,-16.5250],[-68.1060,-16.5270]]
  },
  {
    id: 'CALACOTO', name: 'Calacoto',
    coords: [[-68.0820,-16.5400],[-68.0800,-16.5420],[-68.0770,-16.5450],[-68.0750,-16.5460]]
  },
  {
    id: 'ZONASUR', name: 'San Miguel',
    coords: [[-68.0770,-16.5420],[-68.0750,-16.5440],[-68.0720,-16.5430],[-68.0740,-16.5400],[-68.0770,-16.5420]]
  },
  {
    id: 'CENTRO', name: 'Centro Histórico',
    coords: [[-68.1330,-16.4950],[-68.1310,-16.4960],[-68.1290,-16.4940],[-68.1320,-16.4930],[-68.1330,-16.4950]]
  }
]

// ═══════════════════════════════════════════════════
// SERIALIZATION — Firestore does NOT support nested arrays.
// GeoJSON coordinates are nested arrays, so we convert
// them to flat arrays of {lng, lat} objects for storage.
// The app-side `deserializeGeometry()` in spatialService.js
// converts them back to standard GeoJSON on read.
// ═══════════════════════════════════════════════════

function sanitize(geometry) {
  if (!geometry || !geometry.type) return geometry

  if (geometry.type === 'LineString') {
    return {
      type: 'LineString',
      coordinatesFirestore: geometry.coordinates.map(c => ({ lng: c[0], lat: c[1] }))
    }
  }
  if (geometry.type === 'Polygon') {
    // Polygon.coordinates = [ [ring1], [ring2...] ] — take outer ring only
    const ring = geometry.coordinates[0]
    return {
      type: 'Polygon',
      coordinatesFirestore: ring.map(c => ({ lng: c[0], lat: c[1] }))
    }
  }
  if (geometry.type === 'Point') {
    return {
      type: 'Point',
      coordinatesFirestore: { lng: geometry.coordinates[0], lat: geometry.coordinates[1] }
    }
  }
  return geometry
}

// ═══════════════════════════════════════════════════
// WIPE
// ═══════════════════════════════════════════════════

async function clearOperationalData() {
  console.log('\n🧹 Limpiando datos operacionales...')

  // 1. Clear rondaExecutions + their telemetryChunks subcollections
  const execsSnap = await getDocs(collection(db, 'rondaExecutions'))
  let execCount = 0
  for (const execDoc of execsSnap.docs) {
    // Delete subcollection documents first
    const chunksSnap = await getDocs(collection(db, `rondaExecutions/${execDoc.id}/telemetryChunks`))
    for (const chunk of chunksSnap.docs) {
      await deleteDoc(chunk.ref)
    }
    await deleteDoc(execDoc.ref)
    execCount++
  }
  console.log(`  🗑 rondaExecutions: ${execCount} (+ chunks)`)

  // 2. Clear flat collections
  for (const col of OPS_COLLECTIONS) {
    const snap = await getDocs(collection(db, col))
    for (const d of snap.docs) {
      await deleteDoc(d.ref)
    }
    console.log(`  🗑 ${col}: ${snap.size}`)
  }
}

// ═══════════════════════════════════════════════════
// GUARDS — Firestore profile docs only, no Auth accounts
// ═══════════════════════════════════════════════════

function buildGuards(adminUid) {
  const guards = []
  for (let i = 1; i <= 5; i++) {
    guards.push({
      docId: `guard_${String(i).padStart(3, '0')}`,
      uid: `guard_${String(i).padStart(3, '0')}`,
      email: `guardia${i}@sentinelops.dev`,
      fullName: `Guardia Operativo ${i}`,
      role: 'guard',
      status: 'active',
      guardId: `G-00${i}`
    })
  }
  return guards
}

async function seedGuards(guards) {
  console.log('\n👮 Guardias...')
  for (const g of guards) {
    await setDoc(doc(db, 'users', g.docId), {
      uid: g.uid,
      email: g.email,
      fullName: g.fullName,
      role: g.role,
      status: g.status,
      guardId: g.guardId,
      createdAt: serverTimestamp()
    })
  }
  console.log(`  ✅ ${guards.length} guardias creados`)
}

// ═══════════════════════════════════════════════════
// SPATIAL DATA — Routes, Geofences, Checkpoints
// ═══════════════════════════════════════════════════

async function seedSpatialData() {
  console.log('\n🗺 Rutas, Geocercas y Checkpoints (La Paz)...')
  const result = { routes: [], geofences: [], checkpoints: [] }

  for (const zone of LP_ZONES) {
    const routeId = `route_${zone.id}`
    const gfId = `gf_${zone.id}`

    // Route (Turf Feature → extract .geometry)
    const lineFeature = turf.lineString(zone.coords)
    const lineGeo = lineFeature.geometry // pure {type, coordinates}

    await setDoc(doc(db, 'routes', routeId), {
      name: `Ruta ${zone.name}`,
      status: 'active',
      geometry: sanitize(lineGeo),
      createdAt: serverTimestamp()
    })
    // Keep the ORIGINAL Turf feature in memory for simulation (not the sanitized version)
    result.routes.push({ id: routeId, geometry: lineFeature, name: zone.name })

    // Geofence (buffer around route → polygon)
    const buffered = turf.buffer(lineFeature, 0.05, { units: 'kilometers' })
    await setDoc(doc(db, 'geofences', gfId), {
      name: `Geocerca ${zone.name}`,
      status: 'active',
      geometry: sanitize(buffered.geometry),
      createdAt: serverTimestamp()
    })
    result.geofences.push({ id: gfId, geometry: buffered.geometry })

    // Checkpoints (start, mid, end along the route)
    const lengthKm = turf.length(lineFeature, { units: 'kilometers' })
    const cpDistances = [0, lengthKm / 2, lengthKm]
    const cpIds = []

    for (let i = 0; i < cpDistances.length; i++) {
      const cpId = `${routeId}_cp_${i}`
      const ptFeature = turf.along(lineFeature, cpDistances[i], { units: 'kilometers' })
      const ptGeo = ptFeature.geometry // {type: 'Point', coordinates: [lng, lat]}

      await setDoc(doc(db, 'checkpoints', cpId), {
        name: `CP-${i + 1} ${zone.name}`,
        geometry: sanitize(ptGeo),
        radius: 30,
        status: 'active',
        createdAt: serverTimestamp()
      })
      cpIds.push(cpId)
    }
    result.checkpoints.push({ routeId, cpIds })
  }

  console.log(`  ✅ ${result.routes.length} rutas, ${result.geofences.length} geocercas, ${result.checkpoints.flat().length || result.routes.length * 3} checkpoints`)
  return result
}

// ═══════════════════════════════════════════════════
// RONDAS (templates)
// ═══════════════════════════════════════════════════

async function seedRondas(spatial) {
  console.log('\n📋 Rondas...')
  const rondas = []

  for (let i = 0; i < spatial.routes.length; i++) {
    const route = spatial.routes[i]
    const cpData = spatial.checkpoints[i]
    const rondaId = `ronda_${i}`

    const ronda = {
      name: `Patrullaje Diurno - ${route.name}`,
      routeId: route.id,
      geofenceId: spatial.geofences[i].id,
      checkpointIds: cpData.cpIds,
      expectedDurationMinutes: 30,
      status: 'active',
      createdAt: serverTimestamp()
    }
    await setDoc(doc(db, 'rondas', rondaId), ronda)
    rondas.push({ id: rondaId, ...ronda })
  }

  console.log(`  ✅ ${rondas.length} rondas`)
  return rondas
}

// ═══════════════════════════════════════════════════
// TELEMETRY SIMULATION ENGINE
// ═══════════════════════════════════════════════════

function generateTrack(routeFeature, speedKmh, intervalSecs, anomalyType) {
  const lengthKm = turf.length(routeFeature, { units: 'kilometers' })
  const totalSecs = (lengthKm / speedKmh) * 3600
  const steps = Math.ceil(totalSecs / intervalSecs)
  const distPerStep = speedKmh * (intervalSecs / 3600)

  const track = []
  let dist = 0
  let anomalyCount = 0

  for (let i = 0; i <= steps; i++) {
    if (dist > lengthKm) dist = lengthKm
    const pt = turf.along(routeFeature, dist, { units: 'kilometers' })
    let lng = pt.geometry.coordinates[0]
    let lat = pt.geometry.coordinates[1]

    // Inject anomaly at 50% of route
    if (i === Math.floor(steps / 2)) {
      if (anomalyType === 'drift') {
        const j = turf.destination(pt, 0.2, 90, { units: 'kilometers' })
        lng = j.geometry.coordinates[0]; lat = j.geometry.coordinates[1]
        anomalyCount++
      } else if (anomalyType === 'geofence_exit') {
        const j = turf.destination(pt, 0.5, 180, { units: 'kilometers' })
        lng = j.geometry.coordinates[0]; lat = j.geometry.coordinates[1]
        anomalyCount++
      } else if (anomalyType === 'teleport_jump') {
        const j = turf.destination(pt, 1.5, 45, { units: 'kilometers' })
        lng = j.geometry.coordinates[0]; lat = j.geometry.coordinates[1]
        anomalyCount++
      }
    }

    track.push({ lng, lat, offsetSecs: i * intervalSecs })

    // Inactivity: repeat same point for 15 min at 33% of route
    if (anomalyType === 'inactivity' && i === Math.floor(steps / 3)) {
      const inactiveSteps = Math.floor(900 / intervalSecs)
      for (let j = 1; j <= inactiveSteps; j++) {
        track.push({ lng, lat, offsetSecs: (i * intervalSecs) + (j * intervalSecs) })
      }
      anomalyCount++
      // Skip ahead to avoid double-counting
      dist += distPerStep * inactiveSteps
    }

    dist += distPerStep
  }

  return { track, anomalyCount }
}

// ═══════════════════════════════════════════════════
// EXECUTION SEEDING
// ═══════════════════════════════════════════════════

async function seedExecutions(adminUid, guards, rondas, routes) {
  console.log('\n🏃 Rondas históricas + telemetryChunks...')
  const TOTAL = 25
  const ANOMALIES = [
    'normal', 'normal', 'drift', 'geofence_exit', 'inactivity',
    'impossible_speed', 'teleport_jump', 'skipped_checkpoint', 'normal', 'normal'
  ]
  const CHUNK_SIZE = 20

  let totalPoints = 0
  let totalChunks = 0

  for (let i = 0; i < TOTAL; i++) {
    const guard = guards[i % guards.length]
    const ronda = rondas[i % rondas.length]
    const routeDef = routes.find(r => r.id === ronda.routeId)
    const anomaly = ANOMALIES[i % ANOMALIES.length]

    const execId = `exec_${i.toString().padStart(3, '0')}`
    const daysAgo = i + 1
    const startMs = Date.now() - (daysAgo * 86400000)

    // Generate GPS track
    const speed = anomaly === 'impossible_speed' ? 120 : 5
    const { track, anomalyCount } = generateTrack(routeDef.geometry, speed, 5, anomaly)
    const endMs = startMs + (track[track.length - 1].offsetSecs * 1000)

    // Operational metadata
    const status = anomaly === 'inactivity' ? 'failed' : 'completed'
    let score = 95
    if (anomaly !== 'normal') score -= 30
    if (anomaly === 'skipped_checkpoint') score -= 20

    const completedCheckpoints = anomaly === 'skipped_checkpoint'
      ? [ronda.checkpointIds[0]]
      : ronda.checkpointIds

    // Write execution doc (guardId = admin UID so rules pass)
    const execution = {
      assignmentId: `assig_${i}`,
      rondaId: ronda.id,
      routeId: ronda.routeId,
      guardId: adminUid, // Use admin UID to satisfy Firestore rules
      guardLabel: guard.guardId, // Human-readable label for UI
      status,
      startedAt: startMs,
      endedAt: endMs,
      checkpointIds: ronda.checkpointIds,
      completedCheckpoints,
      totalDistance: turf.length(routeDef.geometry, { units: 'kilometers' }),
      anomalyType: anomaly,
      anomalyCount,
      operationalScore: score,
      compliancePercentage: score,
      events: anomaly !== 'normal'
        ? [{ type: 'GPS_ANOMALY', details: anomaly, timestamp: startMs + ((endMs - startMs) / 2) }]
        : [],
      createdAt: serverTimestamp()
    }

    await setDoc(doc(db, 'rondaExecutions', execId), execution)

    // Upload telemetry chunks
    let chunkCount = 0
    let buffer = []

    for (let j = 0; j < track.length; j++) {
      buffer.push({
        lng: track[j].lng,
        lat: track[j].lat,
        timestamp: startMs + (track[j].offsetSecs * 1000),
        accuracy: Math.random() * 10 + 5
      })

      if (buffer.length === CHUNK_SIZE || j === track.length - 1) {
        const chunkId = `chunk_${chunkCount.toString().padStart(4, '0')}`
        await setDoc(
          doc(db, 'rondaExecutions', execId, 'telemetryChunks', chunkId),
          {
            points: buffer,
            count: buffer.length,
            startedAt: buffer[0].timestamp,
            endedAt: buffer[buffer.length - 1].timestamp
          }
        )
        chunkCount++
        buffer = []
      }
    }

    totalPoints += track.length
    totalChunks += chunkCount
    process.stdout.write(`  ✅ ${i + 1}/${TOTAL} | ${status} | ${anomaly} | ${track.length} pts → ${chunkCount} chunks\n`)
  }

  console.log(`\n  🎉 Total: ${totalPoints} puntos GPS en ${totalChunks} chunks`)
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  SentinelOps — Operational Data Seeding (Fase 12.6)')
  console.log('═══════════════════════════════════════════════════')

  // 1. Authenticate as admin (and STAY as admin)
  const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD)
  const adminUid = cred.user.uid
  console.log(`  ✅ Autenticado como admin (${adminUid})`)

  // 2. Wipe operational data
  await clearOperationalData()

  // 3. Seed guards (Firestore docs only, no Auth creation)
  const guards = buildGuards(adminUid)
  await seedGuards(guards)

  // 4. Spatial data
  const spatial = await seedSpatialData()

  // 5. Ronda templates
  const rondas = await seedRondas(spatial)

  // 6. Historical executions + telemetry
  await seedExecutions(adminUid, guards, rondas, spatial.routes)

  console.log('\n═══════════════════════════════════════════════════')
  console.log('  🚀 SEED OPERACIONAL COMPLETADO')
  console.log('═══════════════════════════════════════════════════')
  process.exit(0)
}

main().catch(err => {
  console.error('\n❌ Error:', err)
  process.exit(1)
})
