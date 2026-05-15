import { useState, useEffect, useCallback, useMemo } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '@/config/constants'
import { useMapLayerStore, MAP_LAYERS_CONFIG, getLayerList } from '@/stores/mapLayerStore'
import './BaseMap.css'

/**
 * Tile providers — supports dark mode via CSS filter
 */
const TILE_PROVIDERS = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://openstreetmap.org">OSM</a>',
  },
  carto_dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com">CARTO</a>',
  },
  carto_light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com">CARTO</a>',
  },
}

/**
 * MapController — provides imperative map access to parent
 */
function MapController({ onMapReady }) {
  const map = useMap()

  useEffect(() => {
    if (onMapReady) onMapReady(map)
  }, [map, onMapReady])

  return null
}

/**
 * BaseMap — Professional GIS map foundation
 * 
 * Architecture:
 *   - Renders tile layer + children (layers/markers)
 *   - Layer visibility managed by useLayerManager
 *   - Dark mode via CartoDB dark tiles
 *   - Exposes map instance for imperative control
 *   - Children receive layer visibility context
 * 
 * @param {object} props
 * @param {{ lat: number, lng: number }} [props.center] - Map center
 * @param {number} [props.zoom] - Initial zoom level
 * @param {boolean} [props.darkMode=true] - Use dark tiles
 * @param {boolean} [props.fullscreen=false]
 * @param {boolean} [props.showControls=true]
 * @param {boolean} [props.showLayerPanel=false]
 * @param {boolean} [props.showGpsStatus=false]
 * @param {number} [props.gpsAccuracy] - Current GPS accuracy in meters
 * @param {string} [props.tileProvider='carto_dark'] - Tile provider key
 * @param {Function} [props.onMapReady] - Callback with Leaflet map instance
 * @param {React.ReactNode} props.children - Layer/marker components
 */
export default function BaseMap({
  center,
  zoom = DEFAULT_MAP_ZOOM,
  darkMode = true,
  fullscreen = false,
  showControls = true,
  showLayerPanel = false,
  showGpsStatus = false,
  gpsAccuracy = null,
  tileProvider = 'carto_dark',
  onMapReady,
  children,
}) {
  const [isFullscreen, setIsFullscreen] = useState(fullscreen)
  const [showLayers, setShowLayers] = useState(showLayerPanel)

  // Layer visibility from Zustand store (shared across all components)
  const layerStore = useMapLayerStore()
  const layerList = useMemo(() => getLayerList(layerStore), [layerStore])

  const mapCenter = useMemo(
    () => center ? [center.lat, center.lng] : [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng],
    [center]
  )

  const tileConfig = darkMode
    ? TILE_PROVIDERS.carto_dark
    : (TILE_PROVIDERS[tileProvider] || TILE_PROVIDERS.osm)

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev)
  }, [])

  const getGpsClass = useCallback(() => {
    if (gpsAccuracy === null) return ''
    if (gpsAccuracy <= 10) return 'basemap__gps-dot--high'
    if (gpsAccuracy <= 30) return 'basemap__gps-dot--medium'
    return 'basemap__gps-dot--low'
  }, [gpsAccuracy])

  return (
    <div
      className={`basemap ${isFullscreen ? 'basemap--fullscreen' : ''} ${darkMode ? 'basemap--dark' : ''}`}
      id="basemap"
    >
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url={tileConfig.url}
          attribution={tileConfig.attribution}
          maxZoom={19}
        />

        <MapController onMapReady={onMapReady} />

        {/* Render children (layers, markers, etc.) */}
        {children}
      </MapContainer>

      {/* ─── Map Controls ─── */}
      {showControls && (
        <div className="basemap__controls">
          <button
            className={`basemap__control-btn ${isFullscreen ? 'basemap__control-btn--active' : ''}`}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {isFullscreen ? '⛶' : '⛶'}
          </button>

          <button
            className={`basemap__control-btn ${showLayers ? 'basemap__control-btn--active' : ''}`}
            onClick={() => setShowLayers((prev) => !prev)}
            title="Capas"
          >
            ◫
          </button>
        </div>
      )}

      {/* ─── Layer Panel ─── */}
      {showLayers && (
        <div className="basemap__layer-panel">
          <div className="basemap__layer-title">Capas</div>
          {layerList.map((layer) => (
            <label
              key={layer.id}
              className={`basemap__layer-item ${!layer.visible ? 'basemap__layer-item--hidden' : ''}`}
            >
              <input
                type="checkbox"
                className="basemap__layer-checkbox"
                checked={layer.visible}
                onChange={() => layerStore.toggleLayer(layer.id)}
              />
              <span>{layer.icon}</span>
              <span>{layer.label}</span>
            </label>
          ))}
        </div>
      )}

      {/* ─── GPS Status ─── */}
      {showGpsStatus && gpsAccuracy !== null && (
        <div className="basemap__gps-status">
          <span className={`basemap__gps-dot ${getGpsClass()}`} />
          <span>GPS ±{gpsAccuracy.toFixed(0)}m</span>
        </div>
      )}
    </div>
  )
}
