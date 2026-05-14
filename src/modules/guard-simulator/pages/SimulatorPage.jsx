import { useState, useEffect, useRef } from 'react'
import BaseMap from '@/modules/maps/components/BaseMap/BaseMap'
import SimulatorPanel from '../components/SimulatorPanel'
import { eventBus } from '@/modules/intelligence/events/eventBus'
import { OPERATIONAL_EVENTS } from '@/modules/intelligence/events/eventTaxonomy'
import { operationalOrchestrator } from '@/modules/intelligence/services/operationalOrchestrator'
import { getRoutes, getGeofences } from '@/modules/spatial/services/spatialService'
import { RouteLayer, GeofenceLayer } from '@/modules/maps'
import L from 'leaflet'
import { runValidationProtocol } from '../services/validationProtocol'
import './SimulatorPage.css'

export default function SimulatorPage() {
  const [mapInstance, setMapInstance] = useState(null)
  const [routes, setRoutes] = useState([])
  const [geofences, setGeofences] = useState([])
  const markersRef = useRef(new Map())

  // Start orchestrator on mount
  useEffect(() => {
    operationalOrchestrator.start()
    window.runValidationProtocol = runValidationProtocol // FOR E2E TESTING
    return () => {
      operationalOrchestrator.stop()
      delete window.runValidationProtocol
    }
  }, [])

  useEffect(() => {
    async function loadData() {
      const [r, g] = await Promise.all([getRoutes(), getGeofences()])
      setRoutes(r)
      setGeofences(g)
    }
    loadData()
  }, [])

  useEffect(() => {
    if (!mapInstance) return

    // Create a custom icon for simulated guards
    const guardIcon = L.divIcon({
      className: 'simulator-guard-icon',
      html: '<div class="guard-dot"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    })

    // Listen to fast GPS updates
    const sub = eventBus.subscribe(OPERATIONAL_EVENTS.GPS_POSITION_UPDATED, (payload) => {
      const { guardId, point } = payload
      
      let marker = markersRef.current.get(guardId)
      if (!marker) {
        // Create marker if it doesn't exist
        marker = L.marker([point.lat, point.lng], { icon: guardIcon }).addTo(mapInstance)
        marker.bindTooltip(`Guard ${guardId}`, { permanent: true, direction: 'top' })
        markersRef.current.set(guardId, marker)
      } else {
        // DIRECTLY UPDATE LEAFLET (Zero React Render Thrashing)
        marker.setLatLng([point.lat, point.lng])
      }
    })

    const subEnded = eventBus.subscribe(OPERATIONAL_EVENTS.SIMULATION_ENDED, (payload) => {
      const marker = markersRef.current.get(payload.guardId)
      if (marker) {
        marker.remove()
        markersRef.current.delete(payload.guardId)
      }
    })

    return () => {
      sub()
      subEnded()
      // Cleanup all markers
      markersRef.current.forEach(m => m.remove())
      markersRef.current.clear()
    }
  }, [mapInstance])

  return (
    <div className="simulator-page">
      <div className="simulator-page__sidebar">
        <SimulatorPanel routes={routes} />
      </div>
      <div className="simulator-page__map">
        <BaseMap onMapReady={setMapInstance} showControls={true}>
          {routes.map(r => (
            <RouteLayer key={r.id} route={{ ...r, coordinates: r.geometry.coordinates }} isEditing={false} />
          ))}
          {geofences.map(g => (
            <GeofenceLayer key={g.id} geofence={{ ...g, coordinates: g.geometry.coordinates }} />
          ))}
        </BaseMap>
      </div>
    </div>
  )
}
