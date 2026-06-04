import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, serverTimestamp, arrayUnion,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS, REPORT_STATES, PATROL_TYPES, SHIFT_TYPES } from '@/config/constants'
import { transition, RONDA_STATES, RONDA_EVENTS } from '@/modules/rondas/stateMachine/rondaStateMachine'
import { updateAssignmentStatus } from './rondaAssignmentService'
import { logActivity } from '@/modules/auth/services/authService'
import { getUserProfile } from '@/modules/users/services/userService'
import { getRoute, getGeofences } from '@/modules/spatial/services/spatialService'

/**
 * SentinelOps — Ronda Execution Service
 * Manages the runtime lifecycle of a ronda execution
 * 
 * An Execution is the live operational record:
 *   - State machine transitions
 *   - GPS trail
 *   - Checkpoint completions
 *   - Event log (audit)
 *   - Timing
 */

const LOG_PREFIX = '[ExecutionService]'

/**
 * Start a ronda execution
 * Creates the execution document and transitions assignment to the initial state
 * 
 * @param {object} data
 * @param {string} data.assignmentId
 * @param {string} data.rondaId
 * @param {string} data.routeId
 * @param {string} data.guardId
 * @param {string[]} data.checkpointIds - Ordered checkpoint IDs
 * @param {{ lat: number, lng: number }} data.startPosition
 * @param {string} [data.initialState] - Initial state (default: IN_PROGRESS, or VALIDATING_VOICE for biometric flow)
 * @param {string} [data.clientId] - Empresa cliente (Catar Seguridad Integral)
 * @param {string} [data.patrolType] - Tipo de patrullaje (PATROL_TYPES)
 * @param {string} [data.vehicleId] - Vehículo asignado (opcional)
 * @param {string} [data.trackerId] - Identificador del smartphone/dispositivo
 * @param {string} [data.shift] - Tipo de turno (SHIFT_TYPES)
 * @param {string} [data.reportState] - Estado del reporte (REPORT_STATES)
 * @param {string} [data.voicePassphrase] - Frase biométrica esperada
 * @param {boolean} [data.startedLate] - Flag de auditoría: inició fuera de horario
 * @returns {Promise<string>} Execution ID
 */
export async function startExecution(data) {
  try {
    const initialState = data.initialState || RONDA_STATES.IN_PROGRESS

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
      } catch (_) { /* Non-blocking */ }
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
    const execId = `execution_${guardCodeClean}_${Date.now()}`
    const execRef = doc(db, COLLECTIONS.RONDA_EXECUTIONS, execId)

    const execution = {
      assignmentId: data.assignmentId,
      rondaId: data.rondaId,
      routeId: data.routeId,
      guardId: data.guardId,
      // ─── Denormalized fields (Anti-Lookup) ───
      guardName,
      guardCode,
      routeName,
      geofenceName,
      status: initialState,
      checkpointIds: data.checkpointIds,
      completedCheckpoints: [],
      startedAt: initialState === RONDA_STATES.IN_PROGRESS ? serverTimestamp() : null,
      startPosition: data.startPosition || null,
      lastPosition: data.startPosition || null,
      gpsTrack: data.startPosition ? [{ ...data.startPosition, timestamp: Date.now() }] : [],
      endedAt: null,
      totalDistance: 0,
      events: [{
        type: initialState === RONDA_STATES.VALIDATING_VOICE ? RONDA_EVENTS.VOICE_START : RONDA_EVENTS.START,
        timestamp: Date.now(),
        position: data.startPosition || null,
        details: { assignmentId: data.assignmentId },
      }],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      // ─── Catar Seguridad Integral ───
      clientId: data.clientId || null,
      patrolType: data.patrolType || PATROL_TYPES.A_PIE,
      vehicleId: data.vehicleId || null,
      trackerId: data.trackerId || null,
      shift: data.shift || SHIFT_TYPES.DIURNO,
      reportState: data.reportState || REPORT_STATES.PENDIENTE,
      // ─── Biometría de Voz ───
      voiceValidated: false,
      voiceMatchScore: null,
      audioEvidenceUrl: null,
      voicePassphrase: data.voicePassphrase || null,
      // ─── Auditoría de Tolerancia ───
      startedLate: data.startedLate || false,
    }

    await setDoc(execRef, execution)

    // Update assignment with execution reference AND actual start time
    await updateAssignmentStatus(data.assignmentId, initialState, {
      executionId: execRef.id,
      actualStart: serverTimestamp(),
    })

    // Activity log
    logActivity(data.guardId, initialState === RONDA_STATES.VALIDATING_VOICE ? 'ronda_voice_validation' : 'ronda_started', 'rondas', {
      executionId: execRef.id,
      rondaId: data.rondaId,
      patrolType: execution.patrolType,
      shift: execution.shift,
    })

    // console.log(`${LOG_PREFIX} ✅ Execution started: ${execRef.id} (state: ${initialState})`)
    return execRef.id
  } catch (error) {
    console.error(`${LOG_PREFIX} Error starting execution:`, error)
    throw error
  }
}

/**
 * Register a checkpoint completion
 * @param {string} executionId
 * @param {string} checkpointId
 * @param {{ lat: number, lng: number }} position
 * @param {number} distance - Distance from checkpoint center
 * @param {string} [notes]
 * @returns {Promise<void>}
 */
export async function registerCheckpoint(executionId, checkpointId, position, distance, notes = '') {
  try {
    // console.log(`[ExecutionService] 📝 Writing checkpoint:`, { executionId, checkpointId, distance })

    const execRef = doc(db, COLLECTIONS.RONDA_EXECUTIONS, executionId)

    const checkpointLog = {
      checkpointId,
      position,
      distance,
      notes,
      timestamp: Date.now(),
    }

    await updateDoc(execRef, {
      completedCheckpoints: arrayUnion(checkpointId),
      lastPosition: { ...position, timestamp: Date.now() },
      events: arrayUnion({
        type: RONDA_EVENTS.CHECKPOINT_VALIDATED,
        timestamp: Date.now(),
        position,
        details: { checkpointId, distance },
      }),
      updatedAt: serverTimestamp(),
    })

    const logId = `log_${executionId}_${checkpointId}_${Date.now()}`
    const logRef = doc(db, COLLECTIONS.CHECKPOINT_LOGS, logId)
    await setDoc(logRef, {
      executionId,
      ...checkpointLog,
      guardId: null,
      createdAt: serverTimestamp(),
    })

    // console.log(`${LOG_PREFIX} ✓ Checkpoint registered: ${checkpointId} (${distance.toFixed(0)}m)`)
  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ FAILED to register checkpoint in Firestore:`, error)
    console.error(`${LOG_PREFIX} Error details:`, {
      code: error?.code,
      message: error?.message,
      name: error?.name,
      executionId,
      checkpointId,
    })
    throw error
  }
}

/**
 * Update the execution's last known GPS position
 * Called by the telemetry engine on each GPS tick
 * Updates the root-level lastPosition field (critical for realtimeStore + LiveGuardMarker)
 *
 * @param {string} executionId
 * @param {{ lat: number, lng: number }} position
 * @param {number} [accuracy] - GPS accuracy in meters
 * @returns {Promise<void>}
 */
export async function updateExecutionPosition(executionId, position, accuracy = null) {
  try {
    const execRef = doc(db, COLLECTIONS.RONDA_EXECUTIONS, executionId)

    await updateDoc(execRef, {
      lastPosition: {
        lat: position.lat,
        lng: position.lng,
        timestamp: Date.now(),
        accuracy,
      },
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    // Non-blocking — telemetry can continue even if this fails
    // console.warn(`${LOG_PREFIX} Failed to update lastPosition for ${executionId}:`, error)
  }
}

/**
 * Transition execution to a new state
 * Uses the state machine to validate the transition
 * 
 * @param {string} executionId
 * @param {string} currentState
 * @param {string} nextState
 * @param {object} [context] - Extra context (position, reason, etc.)
 */
export async function transitionExecution(executionId, currentState, nextState, context = {}) {
  // Validate transition through state machine
  const result = transition(currentState, nextState, context)

  try {
    const execRef = doc(db, COLLECTIONS.RONDA_EXECUTIONS, executionId)

    const updates = {
      status: nextState,
      events: arrayUnion({
        type: result.event,
        timestamp: result.timestamp,
        position: context.position || null,
        details: { previousState: currentState, ...context },
      }),
      updatedAt: serverTimestamp(),
    }

    // If completing/ending, set endedAt
    if ([RONDA_STATES.COMPLETED, RONDA_STATES.LATE, RONDA_STATES.FAILED, RONDA_STATES.CANCELLED].includes(nextState)) {
      updates.endedAt = serverTimestamp()
    }

    await updateDoc(execRef, updates)

    // Sync assignment status
    const execSnap = await getDoc(execRef)
    if (execSnap.exists()) {
      const { assignmentId } = execSnap.data()
      if (assignmentId) {
        await updateAssignmentStatus(assignmentId, nextState)
      }
    }

    // console.log(`${LOG_PREFIX} Transition: ${currentState} → ${nextState} (${executionId})`)
  } catch (error) {
    console.error(`${LOG_PREFIX} Error transitioning execution:`, error)
    throw error
  }
}

/**
 * Complete a ronda execution
 * Always transitions to COMPLETED (no LATE penalty)
 *
 * @param {string} executionId
 * @param {string} currentState
 * @param {{ lat: number, lng: number }} position
 */
export async function completeExecution(executionId, currentState, position) {
  // Get assignmentId first to update actualEnd
  const execRef = doc(db, COLLECTIONS.RONDA_EXECUTIONS, executionId)
  const execSnap = await getDoc(execRef)
  if (execSnap.exists()) {
    const { assignmentId } = execSnap.data()
    if (assignmentId) {
      const assignRef = doc(db, COLLECTIONS.RONDA_ASSIGNMENTS, assignmentId)
      await updateDoc(assignRef, {
        actualEnd: serverTimestamp(),
      })
    }
  }

  await transitionExecution(executionId, currentState, RONDA_STATES.COMPLETED, {
    position,
    completedAt: Date.now(),
  })
}

/**
 * Get execution by ID
 * @param {string} executionId
 * @returns {Promise<object|null>}
 */
export async function getExecution(executionId) {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.RONDA_EXECUTIONS, executionId))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching execution:`, error)
    throw error
  }
}

/**
 * Get active executions (for monitoring dashboard)
 * @returns {Promise<object[]>}
 */
export async function getActiveExecutions() {
  try {
    const q = query(
      collection(db, COLLECTIONS.RONDA_EXECUTIONS),
      where('status', 'in', [RONDA_STATES.IN_PROGRESS, RONDA_STATES.PAUSED])
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching active executions:`, error)
    throw error
  }
}

/**
 * Find active execution by assignmentId (rescue query for orphaned sessions)
 * @param {string} assignmentId
 * @returns {Promise<{id: string, data: object}|null>}
 */
export async function findActiveExecutionByAssignment(assignmentId) {
  try {
    const q = query(
      collection(db, COLLECTIONS.RONDA_EXECUTIONS),
      where('assignmentId', '==', assignmentId),
      where('status', 'in', [RONDA_STATES.IN_PROGRESS, RONDA_STATES.PAUSED])
    )
    const snapshot = await getDocs(q)
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    return { id: doc.id, ...doc.data() }
  } catch (error) {
    console.error(`${LOG_PREFIX} Error finding active execution for assignment ${assignmentId}:`, error)
    return null
  }
}

/**
 * Get historical (completed/failed/late) executions
 * Used for Playback and Auditing
 * @returns {Promise<object[]>}
 */
export async function getHistoricalExecutions() {
  try {
    const q = query(
      collection(db, COLLECTIONS.RONDA_EXECUTIONS),
      where('status', 'in', [RONDA_STATES.COMPLETED, RONDA_STATES.LATE, RONDA_STATES.FAILED, RONDA_STATES.CANCELLED]),
      orderBy('startedAt', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching historical executions:`, error)
    throw error
  }
}

/**
 * Fetch and reconstruct the telemetry track from chunks
 * Required for Playback Reconstruction (Phase 12.5)
 * @param {string} executionId
 * @returns {Promise<Array<{lat, lng, timestamp}>>}
 */
export async function getExecutionTelemetry(executionId) {
  try {
    const startTime = performance.now()
    const chunksRef = collection(db, COLLECTIONS.RONDA_EXECUTIONS, executionId, 'telemetryChunks')
    const q = query(chunksRef, orderBy('startedAt', 'asc'))
    
    const snapshot = await getDocs(q)
    const chunks = snapshot.docs.map(doc => doc.data())
    
    // FlatMap chronological chunks into a single GPS track array
    const reconstructedTrack = chunks.flatMap(chunk => chunk.points || [])
    
    const latencyMs = Math.round(performance.now() - startTime)
    // console.log(`[Playback] Reconstructed ${reconstructedTrack.length} points from ${chunks.length} chunks in ${latencyMs}ms.`)
    
    return reconstructedTrack
  } catch (error) {
    console.error(`[Playback] Error fetching telemetry chunks for ${executionId}:`, error)
    return []
  }
}

/**
 * ─── Biometría de Voz — Catar Seguridad Integral ───
 */

/**
 * Start voice validation for an execution
 * Transitions from AVAILABLE/PENDING to VALIDATING_VOICE
 * This is called when the guard confirms the pre-op form
 * and is about to record their voice.
 * 
 * NOTE: In the new flow, startExecution() with initialState: VALIDATING_VOICE
 * is preferred. This function exists for transitioning an existing execution.
 * 
 * @param {string} executionId
 * @param {string} currentState
 * @param {{ lat: number, lng: number }} position
 * @returns {Promise<void>}
 */
export async function startVoiceValidation(executionId, currentState, position) {
  await transitionExecution(executionId, currentState, RONDA_STATES.VALIDATING_VOICE, {
    position,
    details: 'Voice biometric validation initiated',
  })

  const execRef = doc(db, COLLECTIONS.RONDA_EXECUTIONS, executionId)
  await updateDoc(execRef, {
    voiceValidated: false,
    voiceMatchScore: null,
    updatedAt: serverTimestamp(),
  })

  // console.log(`${LOG_PREFIX} 🎤 Voice validation started: ${executionId}`)
}

/**
 * Record voice validation result
 * If passed: transitions to IN_PROGRESS and sets startedAt
 * If failed: transitions to PENDING (retry) or FAILED
 * 
 * @param {string} executionId
 * @param {object} voiceResult
 * @param {number} voiceResult.matchScore - Confidence score (0-1)
 * @param {boolean} voiceResult.passed - Whether voice matched
 * @param {string} [voiceResult.audioEvidenceUrl] - Appwrite URL del audio
 * @param {{ lat: number, lng: number }} [voiceResult.position] - GPS al momento de validar
 * @returns {Promise<void>}
 */
export async function recordVoiceValidation(executionId, voiceResult) {
  try {
    const execRef = doc(db, COLLECTIONS.RONDA_EXECUTIONS, executionId)
    const execSnap = await getDoc(execRef)
    if (!execSnap.exists()) {
      throw new Error(`Execution ${executionId} not found`)
    }

    const { assignmentId, status: currentStatus } = execSnap.data()

    // Determine next state based on result
    const nextState = voiceResult.passed
      ? RONDA_STATES.IN_PROGRESS
      : RONDA_STATES.PENDING // Allow retry

    await transitionExecution(executionId, currentStatus, nextState, {
      position: voiceResult.position,
    })

    const updates = {
      voiceValidated: voiceResult.passed,
      voiceMatchScore: voiceResult.matchScore,
      audioEvidenceUrl: voiceResult.audioEvidenceUrl || null,
      events: arrayUnion({
        type: voiceResult.passed ? RONDA_EVENTS.VOICE_PASS : RONDA_EVENTS.VOICE_FAIL,
        timestamp: Date.now(),
        position: voiceResult.position || null,
        details: {
          matchScore: voiceResult.matchScore,
          passed: voiceResult.passed,
        },
      }),
      updatedAt: serverTimestamp(),
    }

    // If passed, set startedAt (the ronda officially starts now)
    if (voiceResult.passed) {
      updates.startedAt = serverTimestamp()
    }

    await updateDoc(execRef, updates)

    // If passed, also update assignment to IN_PROGRESS
    if (voiceResult.passed && assignmentId) {
      await updateAssignmentStatus(assignmentId, RONDA_STATES.IN_PROGRESS)
    }

    // console.log(`${LOG_PREFIX} 🎤 Voice validation recorded: ${executionId} (score: ${voiceResult.matchScore}, passed: ${voiceResult.passed}) → ${nextState}`)
  } catch (error) {
    console.error(`${LOG_PREFIX} Error recording voice validation:`, error)
    throw error
  }
}
