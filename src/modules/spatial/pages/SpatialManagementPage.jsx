import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/modules/auth/context/AuthContext'
import GisEditorMap from '@/modules/spatial/components/GisEditorMap'
import { saveRoute, saveGeofence, saveCheckpoint, getRoutes, getGeofences, getCheckpoints } from '@/modules/spatial/services/spatialService'
import { latLngToGeoJsonPoint, latLngsToGeoJsonLineString, latLngsToGeoJsonPolygon } from '@/modules/spatial/utils/geoJsonUtils'
import { RouteLayer, GeofenceLayer, CheckpointMarker } from '@/modules/maps'
import { useMapLayerStore } from '@/stores/mapLayerStore'
import { useMapControlStore } from '@/stores/mapControlStore'
import CustomSelect from '@/components/ui/CustomSelect/CustomSelect'
import GISErrorBoundary from '@/modules/spatial/components/GISErrorBoundary'
import './SpatialManagementPage.css'

/**
 * Convert GeoJSON coordinates (from Firestore via deserializeGeometry)
 * to Leaflet-compatible format [{lat, lng}]
 */
function geoJsonToLeafletPositions(geometry) {
  if (!geometry || !geometry.coordinates) return []

  if (geometry.type === 'LineString') {
    return geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
  }

  if (geometry.type === 'Polygon') {
    return geometry.coordinates[0].map(([lng, lat]) => ({ lat, lng }))
  }

  if (geometry.type === 'Point') {
    const [lng, lat] = geometry.coordinates
    return { lat, lng }
  }

  return []
}

/**
 * Accordion Section — collapsible entity group
 */
function AccordionSection({ title, count, icon, isOpen, onToggle, children }) {
  return (
    <div className="accordion-section">
      <button
        className={`accordion-section__header ${isOpen ? 'accordion-section__header--open' : ''}`}
        onClick={onToggle}
      >
        <span className="accordion-section__icon">{icon}</span>
        <span className="accordion-section__title">{title}</span>
        <span className="accordion-section__count">{count}</span>
        <span className={`accordion-section__arrow ${isOpen ? 'accordion-section__arrow--open' : ''}`}>▾</span>
      </button>
      <div className={`accordion-section__body ${isOpen ? 'accordion-section__body--open' : ''}`}>
        <div className="accordion-section__content">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function SpatialManagementPage() {
  const { user } = useAuth()
  const [mode, setMode] = useState('view') // view | draw_route | draw_geofence | draw_checkpoint
  
  // Stored Entities
  const [routes, setRoutes] = useState([])
  const [geofences, setGeofences] = useState([])
  const [checkpoints, setCheckpoints] = useState([])

  // Pending Entity (currently being drawn)
  const [pendingFeature, setPendingFeature] = useState(null)
  const [formData, setFormData] = useState({ name: '', description: '', type: 'restricted', routeId: '', order: 1 })

  // Accordion state
  const [openSections, setOpenSections] = useState({ geofences: true, routes: true, checkpoints: false })

  // Anti-MultiClick lock
  const [checkpointLocked, setCheckpointLocked] = useState(false)

  // Status
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Layer visibility
  const showRoutes = useMapLayerStore((s) => s.routes)
  const showGeofences = useMapLayerStore((s) => s.geofences)
  const showCheckpoints = useMapLayerStore((s) => s.checkpoints)

  // FlyTo control
  const triggerFlyTo = useMapControlStore((s) => s.triggerFlyTo)

  useEffect(() => {
    loadEntities()
  }, [])

  const loadEntities = async () => {
    setLoading(true)
    setError(null)
    try {
      const [r, g, c] = await Promise.all([
        getRoutes(), getGeofences(), getCheckpoints()
      ])
      if (Array.isArray(r)) setRoutes(r)
      if (Array.isArray(g)) setGeofences(g)
      if (Array.isArray(c)) setCheckpoints(c)
    } catch (err) {
      console.error('Failed to load spatial entities', err)
      setError(err.message || 'Error de conexión con Firestore')
    } finally {
      setLoading(false)
    }
  }

  // ─── CustomSelect options ───
  const routeOptions = useMemo(() => [
    { value: '', label: '— Asociar a Ruta —' },
    ...routes.map(r => ({ value: r.id, label: r.name }))
  ], [routes])

  const geofenceTypeOptions = useMemo(() => [
    { value: 'restricted', label: 'Restringida (Alerta)' },
    { value: 'patrol', label: 'Zona de Patrullaje' },
    { value: 'warning', label: 'Advertencia' },
  ], [])

  const handleDrawCreated = (e) => {
    const layer = e.layer
    let geometry = null

    if (mode === 'draw_checkpoint') {
      // Phase 18.4: Anti-MultiClick — lock after first placement
      if (checkpointLocked) {
        layer.remove()
        return
      }
      geometry = { type: 'Point', coordinates: latLngToGeoJsonPoint(layer.getLatLng()) }
      setCheckpointLocked(true) // Lock checkpoint creation
    } else if (mode === 'draw_route') {
      geometry = { type: 'LineString', coordinates: latLngsToGeoJsonLineString(layer.getLatLngs()) }
    } else if (mode === 'draw_geofence') {
      geometry = { type: 'Polygon', coordinates: latLngsToGeoJsonPolygon(layer.getLatLngs()) }
    }

    if (geometry) {
      setPendingFeature({ layer, geometry })

      if (mode === 'draw_checkpoint') {
        const nextOrder = checkpoints.length + 1
        setFormData((prev) => ({ ...prev, order: nextOrder }))
      }
    }
  }

  const handleDrawDeleted = (e) => {
    if (pendingFeature && pendingFeature.layer === e.layer) {
      setPendingFeature(null)
      setCheckpointLocked(false)
    }
  }

  const handleSave = async () => {
    if (!pendingFeature || !formData.name) return

    if ((mode === 'draw_checkpoint' || mode === 'draw_geofence') && !formData.routeId) {
      setError('Debes asociar una ruta para guardar esta entidad')
      return
    }

    try {
      if (mode === 'draw_route') {
        await saveRoute(null, { name: formData.name, description: formData.description, geometry: pendingFeature.geometry }, user.uid)
      } else if (mode === 'draw_geofence') {
        await saveGeofence(null, { name: formData.name, type: formData.type, routeId: formData.routeId, geometry: pendingFeature.geometry }, user.uid)
      } else if (mode === 'draw_checkpoint') {
        await saveCheckpoint(null, {
          name: formData.name,
          description: formData.description,
          routeId: formData.routeId,
          order: parseInt(formData.order, 10) || 0,
          geometry: pendingFeature.geometry,
        }, user.uid)
      }

      // Cleanup
      pendingFeature.layer.remove()
      setPendingFeature(null)
      setCheckpointLocked(false)
      setFormData({ name: '', description: '', type: 'restricted', routeId: '', order: 1 })
      setMode('view')
      loadEntities()
    } catch (err) {
      console.error('Save failed', err)
      setError('Error al guardar la entidad: ' + err.message)
    }
  }

  const cancelDrawing = () => {
    if (pendingFeature) pendingFeature.layer.remove()
    setPendingFeature(null)
    setCheckpointLocked(false)
    setFormData({ name: '', description: '', type: 'restricted', routeId: '', order: 1 })
    setMode('view')
  }

  const toggleSection = (key) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <GISErrorBoundary>
      <div className="spatial-mgmt">
        {/* ─── Sidebar ─── */}
        <div className="spatial-mgmt__sidebar">
          <div className="spatial-mgmt__header">
            <h1 className="spatial-mgmt__title">GIS Editor</h1>
            <span className="spatial-mgmt__subtitle">Trazado Operacional Geoespacial</span>
          </div>

          {error && (
            <div className="spatial-mgmt__error">
              {error}
              <button onClick={loadEntities} className="spatial-mgmt__error-retry">Reintentar</button>
            </div>
          )}

          {/* Tools */}
          <div className="spatial-mgmt__tools">
            <button 
              className={`spatial-mgmt__btn ${mode === 'draw_route' ? 'spatial-mgmt__btn--active' : ''}`}
              onClick={() => { cancelDrawing(); setMode('draw_route') }}
              disabled={loading}
            >
              〰️ Dibujar Ruta
            </button>
            <button 
              className={`spatial-mgmt__btn ${mode === 'draw_geofence' ? 'spatial-mgmt__btn--active' : ''}`}
              onClick={() => { cancelDrawing(); setMode('draw_geofence') }}
              disabled={loading}
            >
              ⬡ Dibujar Geocerca
            </button>
            <button 
              className={`spatial-mgmt__btn ${mode === 'draw_checkpoint' ? 'spatial-mgmt__btn--active' : ''}`}
              onClick={() => { cancelDrawing(); setMode('draw_checkpoint') }}
              disabled={loading}
            >
              📍 Añadir Checkpoint
            </button>
          </div>

          {/* Pending Form — Phase 18.3: CustomSelect instead of native <select> */}
          {pendingFeature && (
            <div className="spatial-mgmt__form">
              <input
                className="spatial-mgmt__input"
                placeholder="Nombre de la entidad..."
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />

              {(mode === 'draw_checkpoint' || mode === 'draw_geofence') && (
                <CustomSelect
                  value={formData.routeId}
                  onChange={(val) => setFormData({...formData, routeId: val})}
                  options={routeOptions}
                  placeholder="— Asociar a Ruta —"
                />
              )}

              {mode === 'draw_checkpoint' && (
                <input
                  className="spatial-mgmt__input"
                  type="number"
                  min="1"
                  placeholder="Orden de visita"
                  value={formData.order}
                  onChange={(e) => setFormData({...formData, order: e.target.value})}
                />
              )}

              {mode === 'draw_geofence' && (
                <CustomSelect
                  value={formData.type}
                  onChange={(val) => setFormData({...formData, type: val})}
                  options={geofenceTypeOptions}
                  placeholder="Tipo de geocerca"
                />
              )}

              <div className="spatial-mgmt__form-actions">
                <button
                  className="spatial-mgmt__btn spatial-mgmt__btn--save"
                  onClick={handleSave}
                  disabled={!formData.name || ((mode === 'draw_checkpoint' || mode === 'draw_geofence') && !formData.routeId) || loading}
                >
                  {loading ? 'Guardando...' : '✓ Guardar'}
                </button>
                <button
                  className="spatial-mgmt__btn spatial-mgmt__btn--cancel"
                  onClick={cancelDrawing}
                >
                  ✕ Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Phase 18.1: Accordion Entities List */}
          <div className="spatial-mgmt__list-container">
            {loading ? (
              <div className="spatial-mgmt__loading">Cargando datos espaciales...</div>
            ) : (
              <>
                <AccordionSection
                  title="Geocercas"
                  count={geofences.length}
                  icon="⬡"
                  isOpen={openSections.geofences}
                  onToggle={() => toggleSection('geofences')}
                >
                  {geofences.length === 0 ? (
                    <div className="spatial-mgmt__empty-section">Sin geocercas</div>
                  ) : geofences.map(g => {
                    const pos = geoJsonToLeafletPositions(g.geometry)
                    const center = Array.isArray(pos) && pos.length > 0 ? pos[0] : null
                    const parentRoute = routes.find((r) => r.id === g.routeId)
                    return (
                      <div
                        key={g.id}
                        className="spatial-mgmt__item"
                        style={{ cursor: center ? 'pointer' : 'default' }}
                        onClick={() => center && triggerFlyTo(center.lat, center.lng, 16)}
                      >
                        <span className="spatial-mgmt__item-name">{g.name}</span>
                        <span className="spatial-mgmt__item-type">{g.type}{parentRoute ? ` · ${parentRoute.name}` : ''}</span>
                        <span className="spatial-mgmt__item-id">{g.id}</span>
                      </div>
                    )
                  })}
                </AccordionSection>

                <AccordionSection
                  title="Rutas"
                  count={routes.length}
                  icon="〰️"
                  isOpen={openSections.routes}
                  onToggle={() => toggleSection('routes')}
                >
                  {routes.length === 0 ? (
                    <div className="spatial-mgmt__empty-section">Sin rutas</div>
                  ) : routes.map(r => {
                    const waypoints = geoJsonToLeafletPositions(r.geometry)
                    const center = Array.isArray(waypoints) && waypoints.length > 0 ? waypoints[0] : null
                    return (
                      <div
                        key={r.id}
                        className="spatial-mgmt__item"
                        style={{ cursor: center ? 'pointer' : 'default' }}
                        onClick={() => center && triggerFlyTo(center.lat, center.lng, 16)}
                      >
                        <span className="spatial-mgmt__item-name">{r.name}</span>
                        <span className="spatial-mgmt__item-type">LineString</span>
                        <span className="spatial-mgmt__item-id">{r.id}</span>
                      </div>
                    )
                  })}
                </AccordionSection>

                <AccordionSection
                  title="Checkpoints"
                  count={checkpoints.length}
                  icon="📍"
                  isOpen={openSections.checkpoints}
                  onToggle={() => toggleSection('checkpoints')}
                >
                  {checkpoints.length === 0 ? (
                    <div className="spatial-mgmt__empty-section">Sin checkpoints</div>
                  ) : checkpoints.map(c => {
                    const position = geoJsonToLeafletPositions(c.geometry)
                    const parentRoute = routes.find((r) => r.id === c.routeId)
                    return (
                      <div
                        key={c.id}
                        className="spatial-mgmt__item"
                        style={{ cursor: 'pointer' }}
                        onClick={() => position?.lat && triggerFlyTo(position.lat, position.lng, 18)}
                      >
                        <span className="spatial-mgmt__item-name">{c.order ? `#${c.order} ${c.name}` : c.name}</span>
                        <span className="spatial-mgmt__item-type">{parentRoute ? parentRoute.name : 'Sin ruta'}</span>
                        <span className="spatial-mgmt__item-id">{c.id}</span>
                      </div>
                    )
                  })}
                </AccordionSection>
              </>
            )}
          </div>
        </div>

        {/* ─── Map Area ─── */}
        <div className="spatial-mgmt__map">
          <GisEditorMap
            mode={mode}
            onDrawCreated={handleDrawCreated}
            onDrawDeleted={handleDrawDeleted}
            allowedLayers={['routes', 'geofences', 'checkpoints']}
          >
          {/* Render Saved Entities — conditional on layer visibility */}
          {showRoutes && routes.map(r => {
            const waypoints = geoJsonToLeafletPositions(r.geometry)
            return (
              <RouteLayer key={r.id} waypoints={waypoints} state={r.status || 'default'} name={r.name} />
            )
          })}
          {showGeofences && geofences.map(g => {
            const positions = geoJsonToLeafletPositions(g.geometry)
            return (
              <GeofenceLayer key={g.id} geofences={[{ id: g.id, name: g.name, type: g.type, polygon: positions }]} />
            )
          })}
          {showCheckpoints && checkpoints.map(c => {
            const position = geoJsonToLeafletPositions(c.geometry)
            return (
              <CheckpointMarker key={c.id} position={position} name={c.name} description={c.description} />
            )
          })}
          </GisEditorMap>
        </div>
      </div>
    </GISErrorBoundary>
  )
}
