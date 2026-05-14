import { useState, useEffect } from 'react'
import { simulatorRegistry } from '@/modules/guard-simulator/services/gpsSimulationEngine'
import { telemetryBufferService } from '@/modules/guard-simulator/services/telemetryBufferService'

export default function SimulatorPanel({ routes }) {
  const [activeGuards, setActiveGuards] = useState([]) // Array of { id, instance }
  const [guardCounter, setGuardCounter] = useState(1)
  const [selectedRoute, setSelectedRoute] = useState('')
  const [isOnline, setIsOnline] = useState(true)

  // Sync network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleToggleOnline = () => {
    const nextStatus = !isOnline
    setIsOnline(nextStatus)
    telemetryBufferService.setOnlineStatus(nextStatus)
  }

  const spawnGuard = () => {
    if (!selectedRoute) return alert('Selecciona una ruta primero')

    const route = routes.find(r => r.id === selectedRoute)
    if (!route) return

    const guardId = `G-${guardCounter.toString().padStart(3, '0')}`
    const sim = simulatorRegistry.create(guardId, {
      routeGeometry: route.geometry,
      speedKmh: 4 + Math.random() * 2, // 4 to 6 kmh
      updateIntervalMs: 1000, // 1 sec
      jitterMeters: 5
    })

    sim.start()

    setActiveGuards(prev => [...prev, { id: guardId, instance: sim }])
    setGuardCounter(c => c + 1)
  }

  const stopGuard = (guardId) => {
    simulatorRegistry.destroy(guardId)
    setActiveGuards(prev => prev.filter(g => g.id !== guardId))
  }

  const togglePause = (guardId) => {
    const sim = simulatorRegistry.get(guardId)
    if (!sim) return
    if (sim.isPaused) {
      sim.resume()
    } else {
      sim.pause()
    }
    // Force re-render to update UI (this is local to the panel, not the map)
    setActiveGuards([...activeGuards])
  }

  return (
    <div className="simulator-panel">
      <div className="simulator-panel__header">
        <h2>Control Táctico (Simulador)</h2>
        <div className="simulator-panel__network">
          <label>
            <input type="checkbox" checked={isOnline} onChange={handleToggleOnline} />
            {isOnline ? '🟢 Red Activa (Online)' : '🔴 Red Caída (Offline)'}
          </label>
        </div>
      </div>

      <div className="simulator-panel__spawn-controls">
        <select 
          value={selectedRoute} 
          onChange={e => setSelectedRoute(e.target.value)}
          className="simulator-panel__select"
        >
          <option value="">-- Seleccionar Ruta --</option>
          {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        
        <button 
          onClick={spawnGuard}
          disabled={!selectedRoute}
          className="simulator-panel__btn simulator-panel__btn--primary"
        >
          ➕ Desplegar Guardia
        </button>

        <button 
          onClick={() => {
            simulatorRegistry.destroyAll()
            setActiveGuards([])
          }}
          className="simulator-panel__btn simulator-panel__btn--danger"
        >
          🛑 Detener Todos
        </button>
      </div>

      <div className="simulator-panel__list">
        <h3>Guardias Activos ({activeGuards.length})</h3>
        {activeGuards.map(g => {
          const sim = g.instance
          return (
            <div key={g.id} className="simulator-panel__card">
              <div className="simulator-panel__card-header">
                <strong>{g.id}</strong>
                <span className="status-badge">{sim.isPaused ? 'PAUSADO' : 'PATRULLANDO'}</span>
              </div>
              
              <div className="simulator-panel__actions">
                <button onClick={() => togglePause(g.id)}>
                  {sim.isPaused ? '▶️ Resume' : '⏸️ Pause'}
                </button>
                <button onClick={() => sim.triggerDrift(!sim.isDrifting)}>
                  {sim.isDrifting ? '🧭 Fix GPS' : '🌪️ Drift'}
                </button>
                <button onClick={() => sim.dropSignal(!sim.isSignalLost)}>
                  {sim.isSignalLost ? '📡 Restore' : '❌ Drop'}
                </button>
                <button onClick={() => sim.triggerGeofenceExit(100)}>
                  🏃 Break Fence
                </button>
                <button onClick={() => stopGuard(g.id)}>
                  🗑️ Quitar
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
