import { useState, useCallback, useMemo } from 'react'

/**
 * SentinelOps — Layer Manager Service
 * Manages visibility state of all map layers
 * 
 * Decoupled from rendering — only manages state.
 * Components subscribe to layer visibility and render accordingly.
 * 
 * Prepared for: layer toggles, clustering, heatmaps, custom overlays
 */

const LOG_PREFIX = '[LayerManager]'

/**
 * Available layer definitions
 */
export const MAP_LAYERS = {
  GUARDS: {
    id: 'guards',
    label: 'Guardias',
    icon: '👤',
    defaultVisible: true,
    group: 'operational',
  },
  CHECKPOINTS: {
    id: 'checkpoints',
    label: 'Checkpoints',
    icon: '📍',
    defaultVisible: true,
    group: 'operational',
  },
  ROUTES: {
    id: 'routes',
    label: 'Rutas',
    icon: '🗺',
    defaultVisible: true,
    group: 'operational',
  },
  GEOFENCES: {
    id: 'geofences',
    label: 'Geocercas',
    icon: '⬡',
    defaultVisible: false,
    group: 'zones',
  },
  TRACKING: {
    id: 'tracking',
    label: 'Tracking',
    icon: '📡',
    defaultVisible: false,
    group: 'monitoring',
  },
  INCIDENTS: {
    id: 'incidents',
    label: 'Incidentes',
    icon: '⚠',
    defaultVisible: true,
    group: 'alerts',
  },
  HEATMAP: {
    id: 'heatmap',
    label: 'Mapa de Calor',
    icon: '🌡',
    defaultVisible: false,
    group: 'analytics',
  },
}

/**
 * Hook for managing layer visibility
 * @param {object} [initialOverrides] - Override default visibility, e.g. { guards: false }
 */
export function useLayerManager(initialOverrides = {}) {
  // Build initial state from layer defaults + overrides
  const initialState = useMemo(() => {
    const state = {}
    Object.values(MAP_LAYERS).forEach((layer) => {
      state[layer.id] = initialOverrides[layer.id] ?? layer.defaultVisible
    })
    return state
  }, []) // Static on mount

  const [layers, setLayers] = useState(initialState)

  /**
   * Toggle a specific layer
   */
  const toggleLayer = useCallback((layerId) => {
    setLayers((prev) => {
      const newState = { ...prev, [layerId]: !prev[layerId] }
      console.log(`${LOG_PREFIX} Layer "${layerId}" → ${newState[layerId] ? 'ON' : 'OFF'}`)
      return newState
    })
  }, [])

  /**
   * Set a specific layer visibility
   */
  const setLayerVisibility = useCallback((layerId, visible) => {
    setLayers((prev) => ({ ...prev, [layerId]: visible }))
  }, [])

  /**
   * Toggle an entire group
   */
  const toggleGroup = useCallback((groupName) => {
    setLayers((prev) => {
      const newState = { ...prev }
      const groupLayers = Object.values(MAP_LAYERS).filter((l) => l.group === groupName)
      const allVisible = groupLayers.every((l) => prev[l.id])

      groupLayers.forEach((l) => {
        newState[l.id] = !allVisible
      })

      return newState
    })
  }, [])

  /**
   * Show all layers
   */
  const showAll = useCallback(() => {
    setLayers((prev) => {
      const newState = {}
      Object.keys(prev).forEach((key) => {
        newState[key] = true
      })
      return newState
    })
  }, [])

  /**
   * Hide all layers
   */
  const hideAll = useCallback(() => {
    setLayers((prev) => {
      const newState = {}
      Object.keys(prev).forEach((key) => {
        newState[key] = false
      })
      return newState
    })
  }, [])

  /**
   * Check if a layer is visible
   */
  const isLayerVisible = useCallback(
    (layerId) => !!layers[layerId],
    [layers]
  )

  /**
   * Get all layer definitions with current visibility state
   */
  const layerList = useMemo(() => {
    return Object.values(MAP_LAYERS).map((layer) => ({
      ...layer,
      visible: !!layers[layer.id],
    }))
  }, [layers])

  return {
    layers,
    layerList,
    toggleLayer,
    setLayerVisibility,
    toggleGroup,
    showAll,
    hideAll,
    isLayerVisible,
  }
}
