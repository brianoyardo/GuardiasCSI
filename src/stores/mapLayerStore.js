import { create } from 'zustand'

/**
 * mapLayerStore.js
 * Centralized Zustand store for map layer visibility.
 * Replaces the local useLayerManager state so that:
 *   - BaseMap checkboxes update this store
 *   - Any component can read layer visibility
 *   - No prop-drilling required
 */

export const MAP_LAYERS_CONFIG = {
  guards: { label: 'Guardias', icon: '👤', defaultVisible: true, group: 'operational' },
  checkpoints: { label: 'Checkpoints', icon: '📍', defaultVisible: true, group: 'operational' },
  routes: { label: 'Rutas', icon: '🗺', defaultVisible: true, group: 'operational' },
  geofences: { label: 'Geocercas', icon: '⬡', defaultVisible: false, group: 'zones' },
  tracking: { label: 'Tracking', icon: '📡', defaultVisible: false, group: 'monitoring' },
  incidents: { label: 'Incidentes', icon: '⚠', defaultVisible: true, group: 'alerts' },
  heatmap: { label: 'Mapa de Calor', icon: '🌡', defaultVisible: false, group: 'analytics' },
}

const defaultState = {}
Object.entries(MAP_LAYERS_CONFIG).forEach(([id, cfg]) => {
  defaultState[id] = cfg.defaultVisible
})

export const useMapLayerStore = create((set) => ({
  ...defaultState,

  toggleLayer: (layerId) =>
    set((state) => ({ [layerId]: !state[layerId] })),

  setLayerVisibility: (layerId, visible) =>
    set((state) => ({ ...state, [layerId]: visible })),

  toggleGroup: (groupName) =>
    set((state) => {
      const groupLayers = Object.entries(MAP_LAYERS_CONFIG)
        .filter(([, cfg]) => cfg.group === groupName)
        .map(([id]) => id)
      const allVisible = groupLayers.every((id) => state[id])
      const updates = {}
      groupLayers.forEach((id) => {
        updates[id] = !allVisible
      })
      return { ...state, ...updates }
    }),

  showAll: () => {
    const updates = {}
    Object.keys(MAP_LAYERS_CONFIG).forEach((id) => {
      updates[id] = true
    })
    set(updates)
  },

  hideAll: () => {
    const updates = {}
    Object.keys(MAP_LAYERS_CONFIG).forEach((id) => {
      updates[id] = false
    })
    set(updates)
  },

  resetDefaults: () => set(defaultState),
}))

/**
 * Helper: get layer list with current visibility for UI rendering
 */
export function getLayerList(state) {
  return Object.entries(MAP_LAYERS_CONFIG).map(([id, cfg]) => ({
    id,
    label: cfg.label,
    icon: cfg.icon,
    group: cfg.group,
    visible: !!state[id],
  }))
}
