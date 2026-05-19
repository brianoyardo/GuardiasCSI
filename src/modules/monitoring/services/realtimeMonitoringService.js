import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS } from '@/config/constants'
import { RONDA_STATES } from '@/modules/rondas/stateMachine/rondaStateMachine'
import { useRealtimeStore } from '@/stores/realtimeStore'

/**
 * SentinelOps — Realtime Monitoring Service
 * 
 * Purpose: Pure service (no React) that subscribes to Firestore
 * and feeds the Zustand realtimeStore with live execution data.
 * 
 * Architecture:
 *   Firestore onSnapshot → normalize → Zustand store → UI selectors
 * 
 * This is swappable: replace Firestore with WebSocket/MQTT
 * without touching any React components.
 * 
 * Usage:
 *   const unsubscribe = subscribeToActiveExecutions()
 *   // ... later
 *   unsubscribe()
 */

const LOG_PREFIX = '[RealtimeMonitoring]'

/**
 * Active states that require real-time tracking
 */
const ACTIVE_STATES = [
  RONDA_STATES.IN_PROGRESS,
  RONDA_STATES.VALIDATING_VOICE,
  RONDA_STATES.PAUSED,
]

/**
 * Normalize a Firestore execution document into the store format
 * @param {object} docData - { id, ...fields } from Firestore
 * @returns {object} Normalized execution for the store
 */
function normalizeExecution(docData) {
  const { lastPosition, ...rest } = docData

  return {
    ...rest,
    location: lastPosition
      ? {
          lat: lastPosition.lat ?? 0,
          lng: lastPosition.lng ?? 0,
          timestamp: lastPosition.timestamp ?? Date.now(),
          accuracy: lastPosition.accuracy ?? null,
        }
      : null,
  }
}

/**
 * Subscribe to active ronda executions via Firestore onSnapshot
 * 
 * Listens to rondaExecutions where status is IN_PROGRESS, VALIDATING_VOICE, or PAUSED.
 * On each snapshot change:
 *   - 'added' / 'modified' → updateExecution in store
 *   - 'removed' → removeExecution from store (completed/failed)
 * 
 * @returns {Function} unsubscribe function to clean up the listener
 */
export function subscribeToActiveExecutions() {
  // console.log(`${LOG_PREFIX} 🔴 Subscribing to active executions...`)

  const execQuery = query(
    collection(db, COLLECTIONS.RONDA_EXECUTIONS),
    where('status', 'in', ACTIVE_STATES),
    orderBy('startedAt', 'desc')
  )

  const unsubscribe = onSnapshot(
    execQuery,
    (snapshot) => {
      const store = useRealtimeStore.getState()

      // Process individual changes for granular updates
      snapshot.docChanges().forEach((change) => {
        const docData = { id: change.doc.id, ...change.doc.data() }

        if (change.type === 'added' || change.type === 'modified') {
          const normalized = normalizeExecution(docData)
          store.updateExecution(docData.id, normalized)
        }

        if (change.type === 'removed') {
          store.removeExecution(docData.id)
        }
      })

      // console.log(`${LOG_PREFIX} 📊 Snapshot: ${snapshot.size} active executions`)
    },
    (error) => {
      console.error(`${LOG_PREFIX} ❌ Subscription error:`, error)

      // If the error is about a missing index, log a helpful message
      if (error.code === 'failed-precondition') {
        console.error(
          `${LOG_PREFIX} ⚠️  Firestore index required. Check console for index creation link.`
        )
      }
    }
  )

  // console.log(`${LOG_PREFIX} ✅ Subscription active`)
  return unsubscribe
}

/**
 * Subscribe to a single execution by ID
 * Useful for detailed views (Playback, specific guard tracking)
 * 
 * @param {string} executionId
 * @returns {Function} unsubscribe function
 */
export function subscribeToExecution(executionId) {
  // console.log(`${LOG_PREFIX} 🔴 Subscribing to execution: ${executionId}`)

  const execRef = collection(db, COLLECTIONS.RONDA_EXECUTIONS)
  const execQuery = query(execRef, where('__name__', '==', executionId))

  const unsubscribe = onSnapshot(
    execQuery,
    (snapshot) => {
      const store = useRealtimeStore.getState()

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const docData = { id: change.doc.id, ...change.doc.data() }
          store.updateExecution(docData.id, normalizeExecution(docData))
        }
        if (change.type === 'removed') {
          store.removeExecution(docData.id)
        }
      })
    },
    (error) => {
      console.error(`${LOG_PREFIX} ❌ Single execution subscription error:`, error)
    }
  )

  return unsubscribe
}
