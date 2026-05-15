import { create } from 'zustand'

/**
 * SentinelOps — Realtime Store (Zustand)
 * 
 * Purpose: Dictionary-based store for active ronda executions.
 * Designed for Zero-Render Thrashing via strict selectors.
 * 
 * Architecture:
 *   - activeExecutions is a plain object keyed by executionId
 *   - Components select ONLY the execution they care about
 *   - No re-render unless the specific execution's data changes
 * 
 * Flow:
 *   Firestore onSnapshot → realtimeMonitoringService → this store → UI
 */

const LOG_PREFIX = '[RealtimeStore]'

export const useRealtimeStore = create((set, get) => ({
  /**
   * { [executionId]: {
   *   id, guardId, guardLabel, rondaId, routeId, status,
   *   location: { lat, lng, timestamp, accuracy },
   *   clientId, patrolType, shift, reportState,
   *   voiceValidated, voiceMatchScore,
   *   startedAt, lastUpdate
   * } }
   */
  activeExecutions: {},

  /**
   * Initialize or replace the entire executions dictionary
   * @param {object} executionsDict - { [executionId]: executionData }
   */
  setExecutions: (executionsDict) => {
    set({ activeExecutions: executionsDict })
    console.log(`${LOG_PREFIX} 📋 Executions initialized: ${Object.keys(executionsDict).length} active`)
  },

  /**
   * Upsert a single execution (merge into dictionary)
   * @param {string} executionId
   * @param {object} data - Execution data (will be merged)
   */
  updateExecution: (executionId, data) => {
    set((state) => {
      const existing = state.activeExecutions[executionId] || {}
      return {
        activeExecutions: {
          ...state.activeExecutions,
          [executionId]: {
            ...existing,
            ...data,
            id: executionId,
            lastUpdate: Date.now(),
          },
        },
      }
    })
  },

  /**
   * Remove an execution from the dictionary
   * @param {string} executionId
   */
  removeExecution: (executionId) => {
    set((state) => {
      const { [executionId]: _, ...rest } = state.activeExecutions
      return { activeExecutions: rest }
    })
    console.log(`${LOG_PREFIX} 🗑 Execution removed: ${executionId}`)
  },

  /**
   * Bulk update from Firestore snapshot
   * Reconciles: adds new, updates modified, removes deleted
   * @param {object[]} docs - Array of { id, ...data } from Firestore
   */
  syncFromSnapshot: (docs) => {
    const incomingIds = new Set(docs.map((d) => d.id))
    const currentIds = new Set(Object.keys(get().activeExecutions))

    set((state) => {
      const next = { ...state.activeExecutions }

      // Add / update incoming docs
      docs.forEach((doc) => {
        const existing = next[doc.id] || {}
        next[doc.id] = {
          ...existing,
          ...doc,
          id: doc.id,
          lastUpdate: Date.now(),
        }
      })

      // Remove executions no longer in snapshot
      currentIds.forEach((id) => {
        if (!incomingIds.has(id)) {
          delete next[id]
        }
      })

      return { activeExecutions: next }
    })

    console.log(`${LOG_PREFIX} 🔄 Synced: ${docs.length} active executions`)
  },

  /**
   * Clear all executions
   */
  clear: () => set({ activeExecutions: {} }),
}))
