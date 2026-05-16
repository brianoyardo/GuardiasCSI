import { useState, useEffect } from 'react'
import { useAuth } from '@/modules/auth/context/AuthContext'
import GisEditorMap from '@/modules/spatial/components/GisEditorMap'
import { saveRoute, saveGeofence, saveCheckpoint, getRoutes, getGeofences, getCheckpoints } from '@/modules/spatial/services/spatialService'
import { latLngToGeoJsonPoint, latLngsToGeoJsonLineString, latLngsToGeoJsonPolygon } from '@/modules/spatial/utils/geoJsonUtils'
import { RouteLayer, GeofenceLayer, CheckpointMarker } from '@/modules/maps'
import { useMapLayerStore } from '@/stores/mapLayerStore'
import { useMapControlStore } from '@/stores/mapControlStore'
import GISErrorBoundary from '@/modules/spatial/components/GISErrorBoundary'
import './SpatialManagementPage.css'

/**
 * Convert GeoJSON coordinates (from Firestore via deserializeGeometry)
 * to Leaflet-compatible format [{lat, lng}]
 */
function geoJsonToLeafletPositions(geometry) {
  if (!geometry || !geometry.coordinates) return []

  if (geometry.type === 'LineString') {
    // [[lng, lat], ...] → [{lat, lng}, ...]
    return geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
  }

  if (geometry.type === 'Polygon') {
    // [[[lng, lat], ...]] → [{lat, lng}, ...] (outer ring only)
    return geometry.coordinates[0].map(([lng, lat]) => ({ lat, lng }))
  }

  if (geometry.type === 'Point') {
    // [lng, lat] → {lat, lng}
    const [lng, lat] = geometry.coordinates
    return { lat, lng }
  }

  return []
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
  const [formData, setFormData] = useState({ name: '', description: '', type: 'restricted' })

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
      // Only set if we actually got valid arrays back
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

  const handleDrawCreated = (e) => {
    const layer = e.layer
    let geometry = null

    if (mode === 'draw_checkpoint') {
      geometry = { type: 'Point', coordinates: latLngToGeoJsonPoint(layer.getLatLng()) }
    } else if (mode === 'draw_route') {
      geometry = { type: 'LineString', coordinates: latLngsToGeoJsonLineString(layer.getLatLngs()) }
    } else if (mode === 'draw_geofence') {
      geometry = { type: 'Polygon', coordinates: latLngsToGeoJsonPolygon(layer.getLatLngs()) }
    }

    if (geometry) {
      setPendingFeature({ layer, geometry })
    }
  }

  const handleDrawDeleted = (e) => {
    // If the pending layer was deleted, clear pending state
    if (pendingFeature && pendingFeature.layer === e.layer) {
      setPendingFeature(null)
    }
  }

  const handleSave = async () => {
    if (!pendingFeature || !formData.name) return

    try {
      if (mode === 'draw_route') {
        await saveRoute(null, { name: formData.name, description: formData.description, geometry: pendingFeature.geometry }, user.uid)
      } else if (mode === 'draw_geofence') {
        await saveGeofence(null, { name: formData.name, type: formData.type, geometry: pendingFeature.geometry }, user.uid)
      } else if (mode === 'draw_checkpoint') {
        await saveCheckpoint(null, { name: formData.name, description: formData.description, geometry: pendingFeature.geometry }, user.uid)
      }

      // Cleanup
      pendingFeature.layer.remove() // Remove raw drawing
      setPendingFeature(null)
      setFormData({ name: '', description: '', type: 'restricted' })
      setMode('view')
      loadEntities() // Reload from DB
    } catch (err) {
      console.error('Save failed', err)
      setError('Error al guardar la entidad: ' + err.message)
    }
  }

  const cancelDrawing = () => {
    if (pendingFeature) pendingFeature.layer.remove()
    setPendingFeature(null)
    setFormData({ name: '', description: '', type: 'restricted' })
    setMode('view')
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
            <div style={{ padding: '1rem', color: 'var(--color-danger-400)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-danger-500)', margin: '1rem', borderRadius: 'var(--radius-md)' }}>
              {error}
              <button onClick={loadEntities} style={{ display: 'block', marginTop: '0.5rem', background: 'transparent', border: 'none', color: 'var(--color-danger-400)', textDecoration: 'underline', cursor: 'pointer' }}>Reintentar</button>
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

          {/* Pending Form */}
          {pendingFeature && (
            <div className="spatial-mgmt__form">
              <input 
                className="spatial-mgmt__input"
                placeholder="Nombre de la entidad..."
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
              {mode === 'draw_geofence' && (
                <select 
                  className="spatial-mgmt__input"
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                >
                  <option value="restricted">Restringida (Alerta)</option>
                  <option value="patrol">Zona de Patrullaje</option>
                  <option value="warning">Advertencia</option>
                </select>
              )}
              <button 
                className="spatial-mgmt__btn spatial-mgmt__btn--save"
                onClick={handleSave}
                disabled={!formData.name || loading}
              >
                {loading ? 'Guardando...' : 'Guardar Entidad GeoJSON'}
              </button>
            </div>
          )}

          {/* Entities List */}
          <div className="spatial-mgmt__list-container">
            {loading ? (
              <div style={{ color: 'var(--color-dark-text-muted)', textAlign: 'center', padding: '1rem' }}>Cargando datos espaciales...</div>
            ) : (
              <>
                <div className="spatial-mgmt__list-title">Geocercas ({geofences.length})</div>
                {geofences.map(g => {
                  const pos = geoJsonToLeafletPositions(g.geometry)
                  const center = Array.isArray(pos) && pos.length > 0 ? pos[0] : null
                  return (
                    <div
                      key={g.id}
                      className="spatial-mgmt__item"
                      style={{ cursor: center ? 'pointer' : 'default' }}
                      onClick={() => center && triggerFlyTo(center.lat, center.lng, 16)}
                    >
                      <span className="spatial-mgmt__item-name">{g.name}</span>
                      <span className="spatial-mgmt__item-type">{g.type}</span>
                    </div>
                  )
                })}

                <div className="spatial-mgmt__list-title" style={{marginTop: '1rem'}}>Rutas ({routes.length})</div>
                {routes.map(r => {
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
                    </div>
                  )
                })}

                <div className="spatial-mgmt__list-title" style={{marginTop: '1rem'}}>Checkpoints ({checkpoints.length})</div>
                {checkpoints.map(c => {
                  const position = geoJsonToLeafletPositions(c.geometry)
                  return (
                    <div
                      key={c.id}
                      className="spatial-mgmt__item"
                      style={{ cursor: 'pointer' }}
                      onClick={() => triggerFlyTo(position.lat, position.lng, 16)}
                    >
                      <span className="spatial-mgmt__item-name">{c.name}</span>
                      <span className="spatial-mgmt__item-type">Point</span>
                    </div>
                  )
                })}
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
