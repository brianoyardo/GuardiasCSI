import useMonitoringStore from '@/stores/monitoringStore'
import useIncidentStore from '@/stores/incidentStore'
import { useOperationsListener } from '@/modules/monitoring/realtime/useOperationsListener'
import { BaseMap } from '@/modules/maps'
import { STATE_COLORS, STATE_LABELS } from '@/modules/rondas/stateMachine/rondaStateMachine'
import './CommandCenterPage.css'

/**
 * CommandCenterPage — Operational Monitoring Dashboard
 * 
 * Layout: Status Strip → Map + Sidebar
 * 
 * The map is the core — everything is GIS-centered.
 * Sidebar shows live rondas, alerts, incidents.
 * Status strip shows key metrics at a glance.
 */
export default function CommandCenterPage() {
  // Start realtime listeners
  useOperationsListener()

  // Read from Zustand stores (no Firestore calls in UI)
  const {
    activeExecutions,
    alerts,
    unreadAlertCount,
    stats,
    isConnected,
  } = useMonitoringStore()

  const { incidents, openCount, criticalCount } = useIncidentStore()

  const formatTime = (ts) => {
    if (!ts) return ''
    return new Date(ts).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
  }

  const timeSince = (ts) => {
    if (!ts) return ''
    const mins = Math.floor((Date.now() - ts) / 60000)
    if (mins < 1) return 'ahora'
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  return (
    <div className="command-center" id="command-center-page">
      {/* ─── Status Strip ─── */}
      <div className="cc__status-strip">
        <div className="cc__status-items">
          <div className={`cc__stat ${stats.activeGuards > 0 ? 'cc__stat--ok' : ''}`}>
            <span className="cc__stat-value">{stats.activeGuards}</span>
            <span className="cc__stat-label">Guardias</span>
          </div>
          <div className={`cc__stat ${stats.activeRondas > 0 ? 'cc__stat--ok' : ''}`}>
            <span className="cc__stat-value">{stats.activeRondas}</span>
            <span className="cc__stat-label">Rondas</span>
          </div>
          <div className={`cc__stat ${openCount > 0 ? 'cc__stat--warning' : ''}`}>
            <span className="cc__stat-value">{openCount}</span>
            <span className="cc__stat-label">Incidentes</span>
          </div>
          <div className={`cc__stat ${criticalCount > 0 ? 'cc__stat--danger' : ''}`}>
            <span className="cc__stat-value">{criticalCount}</span>
            <span className="cc__stat-label">Críticos</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isConnected && <span className="cc__live-dot" />}
          <span className="cc__live-label">
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* ─── Main: Map + Sidebar ─── */}
      <div className="cc__main">
        {/* Map */}
        <div className="cc__map-section">
          <BaseMap darkMode showControls showLayerPanel />
        </div>

        {/* Sidebar */}
        <div className="cc__sidebar">
          {/* Active Rondas */}
          <div className="cc__sidebar-section">
            <div className="cc__sidebar-title">
              <span>Rondas Activas</span>
              {activeExecutions.length > 0 && (
                <span className="cc__sidebar-count">{activeExecutions.length}</span>
              )}
            </div>

            {activeExecutions.length === 0 ? (
              <div className="cc__empty">Sin rondas activas</div>
            ) : (
              activeExecutions.map((exec) => {
                const progress = exec.checkpointIds?.length
                  ? Math.round(
                      ((exec.completedCheckpoints?.length || 0) / exec.checkpointIds.length) * 100
                    )
                  : 0
                const stateColor = STATE_COLORS[exec.status] || '#64748b'

                return (
                  <div key={exec.id} className="cc__ronda-item">
                    <span
                      className="cc__ronda-dot"
                      style={{ background: stateColor, boxShadow: `0 0 6px ${stateColor}` }}
                    />
                    <div className="cc__ronda-info">
                      <div className="cc__ronda-guard">
                        Guard {exec.guardId?.slice(-4) || '—'}
                      </div>
                      <div className="cc__ronda-meta">
                        {STATE_LABELS[exec.status]} • {exec.completedCheckpoints?.length || 0}/{exec.checkpointIds?.length || 0} CP
                      </div>
                    </div>
                    <div
                      className="cc__ronda-progress"
                      style={{ color: stateColor }}
                    >
                      {progress}%
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Alerts Feed */}
          <div className="cc__sidebar-section">
            <div className="cc__sidebar-title">
              <span>Alertas</span>
              {unreadAlertCount > 0 && (
                <span className="cc__sidebar-count cc__sidebar-count--danger">
                  {unreadAlertCount}
                </span>
              )}
            </div>

            {alerts.length === 0 ? (
              <div className="cc__empty">Sin alertas</div>
            ) : (
              alerts.slice(0, 10).map((alert) => (
                <div key={alert.id} className="cc__alert-item">
                  <span className="cc__alert-icon">
                    {alert.type === 'incident' ? '⚠' : alert.type === 'geofence' ? '⬡' : '🔔'}
                  </span>
                  <div className="cc__alert-content">
                    <div className="cc__alert-title">{alert.title}</div>
                    <div className="cc__alert-msg">{alert.message}</div>
                    <div className="cc__alert-time">{timeSince(alert.timestamp)}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Open Incidents */}
          <div className="cc__sidebar-section">
            <div className="cc__sidebar-title">
              <span>Incidentes Abiertos</span>
              {openCount > 0 && (
                <span className="cc__sidebar-count cc__sidebar-count--danger">{openCount}</span>
              )}
            </div>

            {incidents.length === 0 ? (
              <div className="cc__empty">Sin incidentes</div>
            ) : (
              incidents.slice(0, 8).map((incident) => (
                <div key={incident.id} className="cc__incident-item">
                  <div className={`cc__incident-severity cc__incident-severity--${incident.severity}`} />
                  <div className="cc__incident-info">
                    <div className="cc__incident-title">{incident.title || 'Incidente'}</div>
                    <div className="cc__incident-meta">
                      {incident.type} • {incident.severity}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
