import { useState, useEffect } from 'react'
import { getIncidents, updateIncidentStatus } from '@/modules/incidents/services/incidentService'
import { INCIDENT_SEVERITY } from '@/config/constants'
import { useAuth } from '@/modules/auth/context/AuthContext'
import './IncidentManagementPage.css'

/**
 * IncidentManagementPage — Admin view for managing incidents
 * 
 * Layout: Split view (List | Detail)
 * Prepared for integrating with the Command Center map.
 */
export default function IncidentManagementPage() {
  const { user } = useAuth()
  const [incidents, setIncidents] = useState([])
  const [filter, setFilter] = useState('open') // open | resolved | all
  const [activeIncidentId, setActiveIncidentId] = useState(null)

  useEffect(() => {
    loadIncidents()
  }, [])

  const loadIncidents = async () => {
    try {
      const data = await getIncidents()
      setIncidents(data.sort((a, b) => b.createdAt?.toMillis?.() - a.createdAt?.toMillis?.()))
    } catch (err) {
      console.error('Failed to load incidents:', err)
    }
  }

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await updateIncidentStatus(id, newStatus, {
        resolvedBy: newStatus === 'resolved' ? user.uid : null,
      })
      await loadIncidents() // Reload to get fresh data
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  const filteredList = incidents.filter(i => {
    if (filter === 'open') return i.status !== 'resolved' && i.status !== 'closed'
    if (filter === 'resolved') return i.status === 'resolved' || i.status === 'closed'
    return true
  })

  const activeIncident = incidents.find(i => i.id === activeIncidentId)

  const getSeverityColor = (sev) => {
    switch(sev) {
      case INCIDENT_SEVERITY.CRITICAL: return '#dc2626'
      case INCIDENT_SEVERITY.HIGH: return '#ef4444'
      case INCIDENT_SEVERITY.MEDIUM: return '#f97316'
      default: return '#f59e0b'
    }
  }

  return (
    <div className="inc-mgmt">
      <div className="inc-mgmt__header">
        <h1 className="inc-mgmt__title">Gestión de Incidentes</h1>
      </div>

      <div className="inc-mgmt__content">
        {/* Sidebar List */}
        <div className="inc-mgmt__sidebar">
          <div className="inc-mgmt__filters">
            <button 
              className={`inc-mgmt__filter-btn ${filter === 'open' ? 'inc-mgmt__filter-btn--active' : ''}`}
              onClick={() => setFilter('open')}
            >
              Abiertos
            </button>
            <button 
              className={`inc-mgmt__filter-btn ${filter === 'resolved' ? 'inc-mgmt__filter-btn--active' : ''}`}
              onClick={() => setFilter('resolved')}
            >
              Resueltos
            </button>
            <button 
              className={`inc-mgmt__filter-btn ${filter === 'all' ? 'inc-mgmt__filter-btn--active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Todos
            </button>
          </div>

          <div className="inc-mgmt__list">
            {filteredList.length === 0 ? (
              <div className="inc-mgmt__empty">No hay incidentes</div>
            ) : (
              filteredList.map(inc => (
                <div 
                  key={inc.id}
                  className={`inc-mgmt__card ${activeIncidentId === inc.id ? 'inc-mgmt__card--active' : ''}`}
                  onClick={() => setActiveIncidentId(inc.id)}
                >
                  <div className="inc-mgmt__card-severity" style={{ background: getSeverityColor(inc.severity) }} />
                  <div className="inc-mgmt__card-info">
                    <div className="inc-mgmt__card-title">{inc.title}</div>
                    <div className="inc-mgmt__card-meta">
                      {new Date(inc.createdAt?.toMillis?.() || Date.now()).toLocaleString('es-BO')} • {inc.status}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detail View */}
        <div className="inc-mgmt__detail">
          {!activeIncident ? (
            <div className="inc-mgmt__empty">Selecciona un incidente para ver detalles</div>
          ) : (
            <>
              <div className="inc-mgmt__detail-header">
                <div>
                  <h2 className="inc-mgmt__detail-title">{activeIncident.title}</h2>
                  <div className="inc-mgmt__detail-badges">
                    <span className="inc-mgmt__badge" style={{ background: getSeverityColor(activeIncident.severity), color: 'white' }}>
                      {activeIncident.severity}
                    </span>
                    <span className="inc-mgmt__badge" style={{ background: 'var(--color-dark-surface)', border: '1px solid var(--color-dark-border)' }}>
                      {activeIncident.type}
                    </span>
                    <span className="inc-mgmt__badge" style={{ background: activeIncident.status === 'open' ? 'var(--color-warning-400)' : 'var(--color-accent-600)', color: 'white' }}>
                      {activeIncident.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="inc-mgmt__detail-desc">
                <strong>Descripción:</strong><br/><br/>
                {activeIncident.description || 'Sin descripción proporcionada.'}
              </div>

              {/* Actions */}
              {activeIncident.status !== 'resolved' && activeIncident.status !== 'closed' && (
                <div className="inc-mgmt__actions">
                  <button 
                    className="inc-mgmt__btn inc-mgmt__btn--investigate"
                    onClick={() => handleStatusUpdate(activeIncident.id, 'investigating')}
                  >
                    Marcar En Investigación
                  </button>
                  <button 
                    className="inc-mgmt__btn inc-mgmt__btn--resolve"
                    onClick={() => handleStatusUpdate(activeIncident.id, 'resolved')}
                  >
                    Resolver Incidente
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
