import { create } from 'zustand'

/**
 * SentinelOps — Incident Store (Zustand)
 * Manages incident state for realtime monitoring
 */

const useIncidentStore = create((set, get) => ({
  incidents: [],
  openCount: 0,
  criticalCount: 0,

  setIncidents: (incidents) => {
    const open = incidents.filter((i) => i.status !== 'resolved' && i.status !== 'closed')
    const critical = open.filter((i) => i.severity === 'critical' || i.severity === 'high')
    set({
      incidents,
      openCount: open.length,
      criticalCount: critical.length,
    })
  },

  addIncident: (incident) => {
    set((state) => {
      const updated = [incident, ...state.incidents]
      const open = updated.filter((i) => i.status !== 'resolved' && i.status !== 'closed')
      const critical = open.filter((i) => i.severity === 'critical' || i.severity === 'high')
      return {
        incidents: updated,
        openCount: open.length,
        criticalCount: critical.length,
      }
    })
  },

  updateIncident: (incidentId, updates) => {
    set((state) => {
      const updated = state.incidents.map((i) =>
        i.id === incidentId ? { ...i, ...updates } : i
      )
      const open = updated.filter((i) => i.status !== 'resolved' && i.status !== 'closed')
      return {
        incidents: updated,
        openCount: open.length,
        criticalCount: open.filter((i) => i.severity === 'critical' || i.severity === 'high').length,
      }
    })
  },

  getByStatus: (status) => get().incidents.filter((i) => i.status === status),
  getBySeverity: (severity) => get().incidents.filter((i) => i.severity === severity),

  reset: () => set({ incidents: [], openCount: 0, criticalCount: 0 }),
}))

export default useIncidentStore
