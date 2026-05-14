import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, serverTimestamp, arrayUnion,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS } from '@/config/constants'
import { transition, RONDA_STATES, RONDA_EVENTS } from '@/modules/rondas/stateMachine/rondaStateMachine'
import { updateAssignmentStatus } from './rondaAssignmentService'
import { logActivity } from '@/modules/auth/services/authService'

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
 * Creates the execution document and transitions assignment to IN_PROGRESS
 * 
 * @param {object} data
 * @param {string} data.assignmentId
 * @param {string} data.rondaId
 * @param {string} data.routeId
 * @param {string} data.guardId
 * @param {string[]} data.checkpointIds - Ordered checkpoint IDs
 * @param {{ lat: number, lng: number }} data.startPosition
 * @returns {Promise<string>} Execution ID
 */
export async function startExecution(data) {
  try {
    const execRef = doc(collection(db, COLLECTIONS.RONDA_EXECUTIONS))

    const execution = {
      assignmentId: data.assignmentId,
      rondaId: data.rondaId,
      routeId: data.routeId,
      guardId: data.guardId,
      status: RONDA_STATES.IN_PROGRESS,
      checkpointIds: data.checkpointIds,
      completedCheckpoints: [],
      startedAt: serverTimestamp(),
      startPosition: data.startPosition || null,
      lastPosition: data.startPosition || null,
      gpsTrack: data.startPosition ? [{ ...data.startPosition, timestamp: Date.now() }] : [],
      endedAt: null,
      totalDistance: 0,
      events: [{
        type: RONDA_EVENTS.START,
        timestamp: Date.now(),
        position: data.startPosition || null,
        details: { assignmentId: data.assignmentId },
      }],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    await setDoc(execRef, execution)

    // Update assignment with execution reference
    await updateAssignmentStatus(data.assignmentId, RONDA_STATES.IN_PROGRESS, {
      executionId: execRef.id,
    })

    // Activity log
    logActivity(data.guardId, 'ronda_started', 'rondas', {
      executionId: execRef.id,
      rondaId: data.rondaId,
    })

    console.log(`${LOG_PREFIX} ✅ Execution started: ${execRef.id}`)
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

    // Also write to separate checkpointLogs collection for analytics
    const logRef = doc(collection(db, COLLECTIONS.CHECKPOINT_LOGS))
    await setDoc(logRef, {
      executionId,
      ...checkpointLog,
      guardId: null, // Will be filled by the caller
      createdAt: serverTimestamp(),
    })

    console.log(`${LOG_PREFIX} ✓ Checkpoint registered: ${checkpointId} (${distance.toFixed(0)}m)`)
  } catch (error) {
    console.error(`${LOG_PREFIX} Error registering checkpoint:`, error)
    throw error
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

    console.log(`${LOG_PREFIX} Transition: ${currentState} → ${nextState} (${executionId})`)
  } catch (error) {
    console.error(`${LOG_PREFIX} Error transitioning execution:`, error)
    throw error
  }
}

/**
 * Complete a ronda execution
 * Determines if it's on-time or late
 * 
 * @param {string} executionId
 * @param {string} currentState
 * @param {{ lat: number, lng: number }} position
 * @param {number} scheduledEnd
 */
export async function completeExecution(executionId, currentState, position, scheduledEnd) {
  const isLateCompletion = Date.now() > scheduledEnd
  const finalState = isLateCompletion ? RONDA_STATES.LATE : RONDA_STATES.COMPLETED

  await transitionExecution(executionId, currentState, finalState, {
    position,
    completedAt: Date.now(),
    isLate: isLateCompletion,
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
    console.log(`[Playback] Reconstructed ${reconstructedTrack.length} points from ${chunks.length} chunks in ${latencyMs}ms.`)
    
    return reconstructedTrack
  } catch (error) {
    console.error(`[Playback] Error fetching telemetry chunks for ${executionId}:`, error)
    return []
  }
}
