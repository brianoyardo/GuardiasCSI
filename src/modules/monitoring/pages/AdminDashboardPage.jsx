import { useState, useEffect } from 'react'
import { useAuth } from '@/modules/auth/context/AuthContext'
import useMonitoringStore from '@/stores/monitoringStore'
import useIncidentStore from '@/stores/incidentStore'
import { useOperationsListener } from '@/modules/monitoring/realtime/useOperationsListener'
import './AdminDashboardPage.css'

/**
 * AdminDashboardPage — High-level operational overview
 * Shows KPIs, recent activity, and system health
 */
export default function AdminDashboardPage() {
  useOperationsListener()

  const { user, profile } = useAuth()
  const { stats, isConnected } = useMonitoringStore()
  const { openCount, criticalCount } = useIncidentStore()

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 18) return 'Buenas tardes'
    return 'Buenas noches'
  }

  return (
    <div className="admin-dash" id="admin-dashboard-page">
      <div className="admin-dash__header">
        <div>
          <h1 className="admin-dash__title">
            {greeting()}, {profile?.fullName?.split(' ')[0] || 'Admin'}
          </h1>
          <p className="admin-dash__subtitle">
            Panel de control operativo — SentinelOps
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isConnected && (
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--color-accent-500)',
              boxShadow: '0 0 8px var(--color-accent-500)',
            }} />
          )}
          <span style={{
            fontSize: 'var(--text-xs)',
            color: isConnected ? 'var(--color-accent-400)' : 'var(--color-danger-400)',
            fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1,
          }}>
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="admin-dash__kpis">
        <div className="admin-dash__kpi admin-dash__kpi--primary">
          <span className="admin-dash__kpi-icon">👤</span>
          <span className="admin-dash__kpi-value">{stats.activeGuards}</span>
          <span className="admin-dash__kpi-label">Guardias Activos</span>
        </div>

        <div className="admin-dash__kpi admin-dash__kpi--success">
          <span className="admin-dash__kpi-icon">🗺</span>
          <span className="admin-dash__kpi-value">{stats.activeRondas}</span>
          <span className="admin-dash__kpi-label">Rondas en Progreso</span>
        </div>

        <div className={`admin-dash__kpi ${openCount > 0 ? 'admin-dash__kpi--warning' : 'admin-dash__kpi--success'}`}>
          <span className="admin-dash__kpi-icon">⚠</span>
          <span className="admin-dash__kpi-value">{openCount}</span>
          <span className="admin-dash__kpi-label">Incidentes Abiertos</span>
        </div>

        <div className={`admin-dash__kpi ${criticalCount > 0 ? 'admin-dash__kpi--danger' : 'admin-dash__kpi--success'}`}>
          <span className="admin-dash__kpi-icon">🔴</span>
          <span className="admin-dash__kpi-value">{criticalCount}</span>
          <span className="admin-dash__kpi-label">Incidentes Críticos</span>
        </div>

        <div className="admin-dash__kpi admin-dash__kpi--success">
          <span className="admin-dash__kpi-icon">✓</span>
          <span className="admin-dash__kpi-value">{stats.completedToday}</span>
          <span className="admin-dash__kpi-label">Completadas Hoy</span>
        </div>

        <div className={`admin-dash__kpi ${stats.lateToday > 0 ? 'admin-dash__kpi--warning' : ''}`}>
          <span className="admin-dash__kpi-icon">⏱</span>
          <span className="admin-dash__kpi-value">{stats.lateToday}</span>
          <span className="admin-dash__kpi-label">Con Retraso</span>
        </div>
      </div>

      {/* Quick Activity */}
      <div className="admin-dash__activity">
        <div className="admin-dash__activity-title">Estado del Sistema</div>

        <div className="admin-dash__activity-item">
          <span className="admin-dash__activity-dot" style={{ background: isConnected ? 'var(--color-accent-500)' : 'var(--color-danger-500)' }} />
          <span className="admin-dash__activity-text">
            {isConnected ? 'Conectado a streams operacionales' : 'Desconectado'}
          </span>
          <span className="admin-dash__activity-time">realtime</span>
        </div>

        <div className="admin-dash__activity-item">
          <span className="admin-dash__activity-dot" style={{ background: 'var(--color-primary-500)' }} />
          <span className="admin-dash__activity-text">
            {stats.activeGuards} guardias transmitiendo posición GPS
          </span>
          <span className="admin-dash__activity-time">ahora</span>
        </div>

        <div className="admin-dash__activity-item">
          <span className="admin-dash__activity-dot" style={{ background: openCount > 0 ? 'var(--color-warning-400)' : 'var(--color-accent-500)' }} />
          <span className="admin-dash__activity-text">
            {openCount > 0
              ? `${openCount} incidente(s) requieren atención`
              : 'Sin incidentes pendientes'}
          </span>
          <span className="admin-dash__activity-time">hoy</span>
        </div>
      </div>
    </div>
  )
}
