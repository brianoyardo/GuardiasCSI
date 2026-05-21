import React from 'react'
import { BaseMap } from '@/modules/maps'
import { useGeoman } from '../hooks/useGeoman'

/**
 * Inner component to run the hook inside MapContainer context
 */
function GeomanInjector({ mode, onDrawCreated, onDrawEdited, onDrawDeleted }) {
  useGeoman({ mode, onDrawCreated, onDrawEdited, onDrawDeleted })
  return null
}

/**
 * GisEditorMap — Specialized map for spatial editing
 * Wraps BaseMap and injects Geoman controls
 * Phase 18.2: allowedLayers filters out Tracking/Heatmap
 */
export default function GisEditorMap({
  center,
  zoom = 15,
  mode = 'view',
  onDrawCreated,
  onDrawEdited,
  onDrawDeleted,
  allowedLayers = null,
  children
}) {
  return (
    <BaseMap
      center={center}
      zoom={zoom}
      darkMode={true}
      showControls={true}
      showLayerPanel={true}
      allowedLayers={allowedLayers}
    >
      <GeomanInjector 
        mode={mode}
        onDrawCreated={onDrawCreated}
        onDrawEdited={onDrawEdited}
        onDrawDeleted={onDrawDeleted}
      />
      {children}
    </BaseMap>
  )
}

