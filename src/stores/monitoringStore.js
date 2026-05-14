import { create } from 'zustand'

/**
 * SentinelOps — Monitoring Store (Zustand)
 * Centralized operational state for the command center
 * 
 * This store is the SINGLE SOURCE for all live operational data.
 * Realtime listeners write TO this store.
 * UI components READ FROM this store.
 * 
 * NO Firestore calls happen inside this store — only state management.
 * Listeners are managed separately in realtime/ and feed data here.
 * 
 * Prepared for: Socket.IO, MQTT, WebSocket swap without UI changes.
 */

const useMonitoringStore = create((set, get) => ({
  // ─── Guard Positions ───
  guardPositions: new Map(), // guardId → { lat, lng, timestamp, status, accuracy }
  
  // ─── Active Executions ───
  activeExecutions: [], // Currently in-progress rondas
  
  // ─── Alerts ───
  alerts: [], // Operational alerts (geofence exit, late ronda, etc.)
  unreadAlertCount: 0,
  
  // ─── Live Stats ───
  stats: {
    activeGuards: 0,
    activeRondas: 0,
    completedToday: 0,
    lateToday: 0,
    missedToday: 0,
    openIncidents: 0,
    avgCompletionRate: 0,
  },

  // ─── Connection State ───
  isConnected: false,
  lastSync: null,

  // ─── Actions: Guard Positions ───
  updateGuardPosition: (guardId, positionData) => {
    set((state) => {
      const newMap = new Map(state.guardPositions)
      newMap.set(guardId, {
        ...positionData,
        updatedAt: Date.now(),
      })
      return {
        guardPositions: newMap,
        stats: { ...state.stats, activeGuards: newMap.size },
      }
    })
  },

  removeGuardPosition: (guardId) => {
    set((state) => {
      const newMap = new Map(state.guardPositions)
      newMap.delete(guardId)
      return {
        guardPositions: newMap,
        stats: { ...state.stats, activeGuards: newMap.size },
      }
    })
  },

  // ─── Actions: Executions ───
  setActiveExecutions: (executions) => {
    set({
      activeExecutions: executions,
      stats: {
        ...get().stats,
        activeRondas: executions.length,
      },
    })
  },

  updateExecution: (executionId, updates) => {
    set((state) => ({
      activeExecutions: state.activeExecutions.map((e) =>
        e.id === executionId ? { ...e, ...updates } : e
      ),
    }))
  },

  // ─── Actions: Alerts ───
  addAlert: (alert) => {
    set((state) => ({
      alerts: [{ id: Date.now(), timestamp: Date.now(), ...alert }, ...state.alerts].slice(0, 100),
      unreadAlertCount: state.unreadAlertCount + 1,
    }))
  },

  clearAlerts: () => set({ alerts: [], unreadAlertCount: 0 }),
  markAlertsRead: () => set({ unreadAlertCount: 0 }),

  // ─── Actions: Stats ───
  updateStats: (newStats) => {
    set((state) => ({
      stats: { ...state.stats, ...newStats },
    }))
  },

  // ─── Actions: Connection ───
  setConnected: (connected) => set({ isConnected: connected, lastSync: Date.now() }),

  // ─── Reset ───
  reset: () => set({
    guardPositions: new Map(),
    activeExecutions: [],
    alerts: [],
    unreadAlertCount: 0,
    stats: {
      activeGuards: 0, activeRondas: 0, completedToday: 0,
      lateToday: 0, missedToday: 0, openIncidents: 0, avgCompletionRate: 0,
    },
    isConnected: false,
    lastSync: null,
  }),
}))

export default useMonitoringStore
