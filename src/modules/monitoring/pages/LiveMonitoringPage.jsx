import { useState, useEffect, useMemo } from 'react'
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { BaseMap } from '@/modules/maps'
import { useMapControlStore } from '@/stores/mapControlStore'
import { Marker as LeafletMarker, Popup, Polyline } from 'react-leaflet'
import { L } from 'leaflet'
import './LiveMonitoringPage.css'

const PRESENCE_COLLECTION = 'guardPresence'
const EXECUTIONS_COLLECTION = 'rondaExecutions'
const ACTIVE_THRESHOLD_MS = 2 * 60 * 1000

const STATUS_CONFIG = {
  online: { label: 'En línea', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', icon: '🔵' },
  validating_voice: { label: 'Validando voz', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', icon: '🟣' },
  in_progress: { label: 'En ronda', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', icon: '🟢' },
  offline: { label: 'Desconectado', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.15)', icon: '⚫' },
}

const ALLOWED_LAYERS = ['guards', 'checkpoints', 'routes', 'geofences', 'incidents']

function createGuardIcon(status) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.online
  const color = config.color

  return L.divIcon({
    className: 'guard-marker-icon',
    html: `
      <div class="guard-marker-pin" style="--marker-color: ${color}">
        <div class="guard-marker-dot" style="background: ${color}"></div>
        <div class="guard-marker-pulse" style="border-color: ${color}"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

export default function LiveMonitoringPage() {
  const [guards, setGuards] = useState([])
  const [executions, setExecutions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showStats, setShowStats] = useState(false)
  const triggerFlyTo = useMapControlStore((s) => s.triggerFlyTo)

  useEffect(() => {
    const presenceQuery = query(
      collection(db, PRESENCE_COLLECTION),
      orderBy('lastUpdate', 'desc')
    )

    const unsubPresence = onSnapshot(presenceQuery, (snapshot) => {
      const now = Date.now()
      const activeGuards = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(g => {
          if (!g.lastUpdate) return false
          const ts = g.lastUpdate.toMillis ? g.lastUpdate.toMillis() : g.lastUpdate
          return (now - ts) < ACTIVE_THRESHOLD_MS
        })
        .sort((a, b) => {
          const statusOrder = { in_progress: 0, validating_voice: 1, online: 2, offline: 3 }
          return (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3)
        })

      setGuards(activeGuards)
      setLoading(false)
    })

    return () => unsubPresence()
  }, [])

  useEffect(() => {
    const activeQuery = query(
      collection(db, EXECUTIONS_COLLECTION),
      where('status', 'in', ['in_progress', 'paused', 'validating_voice'])
    )

    const unsubExec = onSnapshot(activeQuery, (snapshot) => {
      const activeExecs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setExecutions(activeExecs)
    })

    return () => unsubExec()
  }, [])

  const guardExecMap = useMemo(() => {
    const map = {}
    executions.forEach(exec => {
      if (exec.guardId) {
        map[exec.guardId] = exec
      }
    })
    return map
  }, [executions])

  const handleFlyTo = (lat, lng) => {
    triggerFlyTo(lat, lng, 18)
  }

  const totalActive = guards.filter(g => g.status === 'in_progress').length
  const totalValidating = guards.filter(g => g.status === 'validating_voice').length
  const totalOnline = guards.filter(g => g.status === 'online').length

  return (
    <div className="live-monitoring" id="live-monitoring-page">
      {/* Map — Full Screen */}
      <div className="live-monitoring__map">
        <BaseMap
          darkMode
          showControls
          showLayerPanel
          allowedLayers={ALLOWED_LAYERS}
        >
          {guards.map(guard => {
            if (!guard.location || !guard.location.lat) return null
            const exec = guardExecMap[guard.id]
            const showTrail = guard.status === 'in_progress' && exec?.gpsTrack && exec.gpsTrack.length > 1

            return (
              <div key={guard.id}>
                <GuardMarker
                  position={[guard.location.lat, guard.location.lng]}
                  icon={createGuardIcon(guard.status)}
                  guardName={guard.guardName || guard.guardCode || guard.id.slice(0, 6)}
                  onClick={() => handleFlyTo(guard.location.lat, guard.location.lng)}
                />
                {showTrail && (
                  <TrailLine trail={exec.gpsTrack} />
                )}
              </div>
            )
          })}
        </BaseMap>
      </div>

      {/* Stats Toggle Button */}
      <button
        className="live-monitoring__stats-toggle"
        onClick={() => setShowStats(!showStats)}
      >
        📊 {guards.length}
      </button>

      {/* Stats Modal */}
      {showStats && (
        <div className="live-monitoring__stats-modal" onClick={() => setShowStats(false)}>
          <div className="live-monitoring__stats-content" onClick={e => e.stopPropagation()}>
            <h3>Estado Global</h3>
            <div className="live-monitoring__stats-grid">
              <div className="live-monitoring__stat-card" style={{ borderColor: STATUS_CONFIG.in_progress.color }}>
                <span className="live-monitoring__stat-icon">{STATUS_CONFIG.in_progress.icon}</span>
                <span className="live-monitoring__stat-value">{totalActive}</span>
                <span className="live-monitoring__stat-label">En Ronda</span>
              </div>
              <div className="live-monitoring__stat-card" style={{ borderColor: STATUS_CONFIG.validating_voice.color }}>
                <span className="live-monitoring__stat-icon">{STATUS_CONFIG.validating_voice.icon}</span>
                <span className="live-monitoring__stat-value">{totalValidating}</span>
                <span className="live-monitoring__stat-label">Validando</span>
              </div>
              <div className="live-monitoring__stat-card" style={{ borderColor: STATUS_CONFIG.online.color }}>
                <span className="live-monitoring__stat-icon">{STATUS_CONFIG.online.icon}</span>
                <span className="live-monitoring__stat-value">{totalOnline}</span>
                <span className="live-monitoring__stat-label">En Línea</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Floating Panel */}
      <div className="live-monitoring__bottom-panel">
        {loading ? (
          <div className="live-monitoring__bottom-loading">Conectando al stream...</div>
        ) : guards.length === 0 ? (
          <div className="live-monitoring__bottom-empty">No hay guardias activos</div>
        ) : (
          guards.map(guard => (
            <GuardCard
              key={guard.id}
              guard={guard}
              onClick={() => guard.location && handleFlyTo(guard.location.lat, guard.location.lng)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function GuardCard({ guard, onClick }) {
  const config = STATUS_CONFIG[guard.status] || STATUS_CONFIG.online
  const guardCode = guard.guardCode || guard.id?.slice(0, 6) || '—'
  const guardName = guard.guardName || 'Sin nombre'
  const accuracy = guard.accuracy ? `±${Math.round(guard.accuracy)}m` : ''

  return (
    <div className="guard-card" onClick={onClick}>
      <div className="guard-card__header">
        <span className="guard-card__code">{guardCode}</span>
        <span
          className="guard-card__status-dot"
          style={{ background: config.color, boxShadow: `0 0 8px ${config.color}` }}
        />
      </div>
      <div className="guard-card__name">{guardName}</div>
      <div className="guard-card__meta">
        <span className="guard-card__status-label" style={{ color: config.color }}>
          {config.label}
        </span>
        {accuracy && <span className="guard-card__accuracy">{accuracy}</span>}
      </div>
    </div>
  )
}

function GuardMarker({ position, icon, guardName, onClick }) {
  return (
    <LeafletMarker position={position} icon={icon} eventHandlers={{ click: onClick }}>
      <Popup>
        <div style={{ fontWeight: 600, fontSize: '14px' }}>{guardName}</div>
      </Popup>
    </LeafletMarker>
  )
}

function TrailLine({ trail }) {
  const coords = trail.map(p => [p.lat || p.latitude, p.lng || p.longitude]).filter(c => c[0] && c[1])
  if (coords.length < 2) return null

  return (
    <Polyline
      positions={coords}
      pathOptions={{
        color: '#3b82f6',
        weight: 3,
        opacity: 0.8,
        dashArray: '8, 6',
      }}
    />
  )
}
