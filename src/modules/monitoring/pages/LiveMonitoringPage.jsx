import { useState, useEffect, useMemo } from 'react'
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { BaseMap } from '@/modules/maps'
import { useMapControlStore } from '@/stores/mapControlStore'
import { Marker as LeafletMarker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
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
      {/* ─── Status Strip (Top) ─── */}
      <div className="lm__status-strip">
        <div className="lm__status-items">
          <div className="lm__stat">
            <span className="lm__stat-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_CONFIG.in_progress.color }} />
            <span className="lm__stat-value" style={{ color: STATUS_CONFIG.in_progress.color }}>{totalActive}</span>
            <span className="lm__stat-label">En Ronda</span>
          </div>
          <div className="lm__stat">
            <span className="lm__stat-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_CONFIG.validating_voice.color }} />
            <span className="lm__stat-value" style={{ color: STATUS_CONFIG.validating_voice.color }}>{totalValidating}</span>
            <span className="lm__stat-label">Validando</span>
          </div>
          <div className="lm__stat">
            <span className="lm__stat-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_CONFIG.online.color }} />
            <span className="lm__stat-value" style={{ color: STATUS_CONFIG.online.color }}>{totalOnline}</span>
            <span className="lm__stat-label">Online</span>
          </div>
        </div>
      </div>

      {/* ─── Main Content (Map + Sidebar) ─── */}
      <div className="lm__main">
        <div className="lm__map-section">
          <BaseMap darkMode showControls showLayerPanel allowedLayers={ALLOWED_LAYERS}>
            {guards.map(guard => {
              if (!guard.location || !guard.location.lat) return null
              const exec = guardExecMap[guard.id]
              const showTrail = guard.status === 'in_progress' && exec?.gpsTrack && exec.gpsTrack.length > 1
              return (
                <div key={`map-guard-${guard.id}`}>
                  <GuardMarker
                    position={[guard.location.lat, guard.location.lng]}
                    icon={createGuardIcon(guard.status)}
                    guardName={guard.guardName || guard.guardCode || guard.id.slice(0, 6)}
                    onClick={() => handleFlyTo(guard.location.lat, guard.location.lng)}
                  />
                  {showTrail && <TrailLine trail={exec.gpsTrack} />}
                </div>
              )
            })}
          </BaseMap>
        </div>

        <div className="lm__sidebar">
          <div className="lm__sidebar-section">
            <div className="lm__sidebar-title">
              <span>Fuerza Activa</span>
              <span style={{ background: 'var(--color-primary-600)', padding: '2px 8px', borderRadius: 10, color: '#fff' }}>
                {guards.length}
              </span>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', color: '#888', padding: '20px' }}>Conectando al stream...</div>
            ) : guards.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#888', padding: '20px' }}>Sin guardias activos</div>
            ) : (
              guards.map(guard => {
                const config = STATUS_CONFIG[guard.status] || STATUS_CONFIG.online
                return (
                  <div
                    key={`sidebar-guard-${guard.id}`}
                    className="lm__guard-item"
                    onClick={() => guard.location && handleFlyTo(guard.location.lat, guard.location.lng)}
                  >
                    <div className="lm__guard-dot" style={{ background: config.color, boxShadow: `0 0 8px ${config.color}` }} />
                    <div className="lm__guard-info">
                      <div className="lm__guard-code">{guard.guardCode || guard.id.slice(0, 6)}</div>
                      <div className="lm__guard-name">{guard.guardName || 'Sin nombre'}</div>
                    </div>
                    <div className="lm__guard-status" style={{ color: config.color }}>
                      {config.label}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
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
