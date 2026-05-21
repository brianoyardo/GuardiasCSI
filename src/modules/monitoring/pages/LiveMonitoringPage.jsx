import { useState, useEffect, useMemo } from 'react'
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { BaseMap } from '@/modules/maps'
import { useMapControlStore } from '@/stores/mapControlStore'
import { subscribeToActiveIncidents } from '@/modules/incidents/services/incidentService'
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

const SEVERITY_CONFIG = {
  critical: { label: 'Crítico', color: '#ef4444', icon: '🔴' },
  high: { label: 'Alto', color: '#f97316', icon: '🟠' },
  medium: { label: 'Medio', color: '#eab308', icon: '🟡' },
  low: { label: 'Bajo', color: '#22c55e', icon: '🟢' },
}

const ALLOWED_LAYERS = ['guards', 'checkpoints', 'routes', 'geofences', 'incidents']

/**
 * Guard Marker Icon — L.divIcon with code + name overlay
 * Phase 17.2: Monospaced code, muted name, pulse animation
 */
function createGuardIcon(status, guardCode, guardName) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.online
  const color = config.color
  const code = guardCode || '???'
  const name = guardName || ''

  return L.divIcon({
    className: 'guard-marker-icon',
    html: `
      <div class="guard-marker-tactical" style="--marker-color: ${color}">
        <div class="guard-marker-pulse-ring" style="border-color: ${color}"></div>
        <div class="guard-marker-body" style="background: ${color}20; border-color: ${color}">
          <span class="guard-marker-code" style="color: ${color}">${code}</span>
          <span class="guard-marker-name">${name.length > 14 ? name.slice(0, 12) + '…' : name}</span>
        </div>
      </div>
    `,
    iconSize: [88, 44],
    iconAnchor: [44, 22],
  })
}

export default function LiveMonitoringPage() {
  const [guards, setGuards] = useState([])
  const [executions, setExecutions] = useState([])
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [sidebarTab, setSidebarTab] = useState('guards') // 'guards' | 'incidents'
  const [severityFilter, setSeverityFilter] = useState(null) // null = all
  const triggerFlyTo = useMapControlStore((s) => s.triggerFlyTo)

  // ─── Presence Stream ───
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

  // ─── Active Executions Stream (for trail lines) ───
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

  // ─── Active Incidents Stream (Phase 17.4) ───
  useEffect(() => {
    const unsubscribe = subscribeToActiveIncidents(setIncidents)
    return () => unsubscribe()
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

  // ─── Filtered incidents ───
  const filteredIncidents = useMemo(() => {
    if (!severityFilter) return incidents
    return incidents.filter(i => i.severity === severityFilter)
  }, [incidents, severityFilter])

  const handleFlyTo = (lat, lng) => {
    triggerFlyTo(lat, lng, 18)
  }

  const formatIncidentTime = (ts) => {
    if (!ts) return '—'
    const d = ts.toMillis ? new Date(ts.toMillis()) : new Date(ts)
    return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
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
            <span className="lm__stat-dot" style={{ background: STATUS_CONFIG.in_progress.color }} />
            <span className="lm__stat-value" style={{ color: STATUS_CONFIG.in_progress.color }}>{totalActive}</span>
            <span className="lm__stat-label">En Ronda</span>
          </div>
          <div className="lm__stat">
            <span className="lm__stat-dot" style={{ background: STATUS_CONFIG.validating_voice.color }} />
            <span className="lm__stat-value" style={{ color: STATUS_CONFIG.validating_voice.color }}>{totalValidating}</span>
            <span className="lm__stat-label">Validando</span>
          </div>
          <div className="lm__stat">
            <span className="lm__stat-dot" style={{ background: STATUS_CONFIG.online.color }} />
            <span className="lm__stat-value" style={{ color: STATUS_CONFIG.online.color }}>{totalOnline}</span>
            <span className="lm__stat-label">Online</span>
          </div>
          <div className="lm__stat lm__stat--incidents">
            <span className="lm__stat-dot" style={{ background: '#ef4444' }} />
            <span className="lm__stat-value" style={{ color: '#ef4444' }}>{incidents.length}</span>
            <span className="lm__stat-label">Incidentes</span>
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
                    icon={createGuardIcon(guard.status, guard.guardCode, guard.guardName)}
                    guardCode={guard.guardCode || guard.id.slice(0, 6)}
                    guardName={guard.guardName || 'Sin nombre'}
                    guardStatus={STATUS_CONFIG[guard.status]?.label || guard.status}
                    onClick={() => handleFlyTo(guard.location.lat, guard.location.lng)}
                  />
                  {showTrail && <TrailLine trail={exec.gpsTrack} />}
                </div>
              )
            })}
          </BaseMap>
        </div>

        <div className="lm__sidebar">
          {/* ─── Sidebar Tabs ─── */}
          <div className="lm__sidebar-tabs">
            <button
              className={`lm__sidebar-tab ${sidebarTab === 'guards' ? 'lm__sidebar-tab--active' : ''}`}
              onClick={() => setSidebarTab('guards')}
            >
              👥 Guardias <span className="lm__tab-badge">{guards.length}</span>
            </button>
            <button
              className={`lm__sidebar-tab ${sidebarTab === 'incidents' ? 'lm__sidebar-tab--active' : ''}`}
              onClick={() => setSidebarTab('incidents')}
            >
              ⚠️ Incidentes <span className="lm__tab-badge lm__tab-badge--red">{incidents.length}</span>
            </button>
          </div>

          {/* ─── Guards Panel ─── */}
          {sidebarTab === 'guards' && (
            <div className="lm__sidebar-section">
              {loading ? (
                <div className="lm__sidebar-empty">Conectando al stream...</div>
              ) : guards.length === 0 ? (
                <div className="lm__sidebar-empty">Sin guardias activos</div>
              ) : (
                <div className="lm__guard-list">
                  {guards.map(guard => {
                    const config = STATUS_CONFIG[guard.status] || STATUS_CONFIG.online
                    const exec = guardExecMap[guard.id]
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
                          {exec?.routeName && (
                            <div className="lm__guard-route">📍 {exec.routeName}</div>
                          )}
                        </div>
                        <div className="lm__guard-status" style={{ color: config.color }}>
                          {config.label}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── Incidents Panel (Phase 17.4) ─── */}
          {sidebarTab === 'incidents' && (
            <div className="lm__sidebar-section">
              {/* Severity Filters */}
              <div className="lm__severity-filters">
                <button
                  className={`lm__severity-btn ${!severityFilter ? 'lm__severity-btn--active' : ''}`}
                  onClick={() => setSeverityFilter(null)}
                >
                  Todos
                </button>
                {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    className={`lm__severity-btn ${severityFilter === key ? 'lm__severity-btn--active' : ''}`}
                    onClick={() => setSeverityFilter(severityFilter === key ? null : key)}
                    style={severityFilter === key ? { borderColor: cfg.color, color: cfg.color } : {}}
                  >
                    {cfg.icon}
                  </button>
                ))}
              </div>

              {filteredIncidents.length === 0 ? (
                <div className="lm__sidebar-empty">Sin incidentes activos</div>
              ) : (
                <div className="lm__incident-list">
                  {filteredIncidents.map(inc => {
                    const sevCfg = SEVERITY_CONFIG[inc.severity] || SEVERITY_CONFIG.low
                    const hasLocation = inc.location && inc.location.lat
                    return (
                      <div
                        key={`incident-${inc.id}`}
                        className={`lm__incident-item ${hasLocation ? 'lm__incident-item--clickable' : ''}`}
                        onClick={() => hasLocation && handleFlyTo(inc.location.lat, inc.location.lng)}
                      >
                        <div className="lm__incident-severity" style={{ background: sevCfg.color }} />
                        <div className="lm__incident-info">
                          <div className="lm__incident-title">{inc.title}</div>
                          <div className="lm__incident-meta">
                            {inc.guardCode && (
                              <span className="lm__incident-guard">{inc.guardCode}</span>
                            )}
                            <span className="lm__incident-time">{formatIncidentTime(inc.createdAt)}</span>
                          </div>
                        </div>
                        <div className="lm__incident-type" style={{ color: sevCfg.color }}>
                          {sevCfg.label}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function GuardMarker({ position, icon, guardCode, guardName, guardStatus, onClick }) {
  return (
    <LeafletMarker position={position} icon={icon} eventHandlers={{ click: onClick }}>
      <Popup>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '14px', color: '#e0e0e0' }}>{guardCode}</div>
        <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>{guardName}</div>
        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>{guardStatus}</div>
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
