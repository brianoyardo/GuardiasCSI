import { useState, useEffect } from 'react'
import { getIncidents, updateIncidentStatus } from '@/modules/incidents/services/incidentService'
import { getEvidencePreviewUrl } from '@/services/appwriteStorage'
import { INCIDENT_SEVERITY } from '@/config/constants'
import { useAuth } from '@/modules/auth/context/AuthContext'
import './IncidentManagementPage.css'

/**
 * IncidentManagementPage — Admin view for managing incidents
 * Phase 19: Appwrite media preview + Guard identity display
 */
export default function IncidentManagementPage() {
  const { user } = useAuth()
  const [incidents, setIncidents] = useState([])
  const [filter, setFilter] = useState('open')
  const [activeIncidentId, setActiveIncidentId] = useState(null)
  const [mediaModal, setMediaModal] = useState(null) // { url, name } or null
  const [zoomLevel, setZoomLevel] = useState(1)

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
      await loadIncidents()
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

  // Phase 19.1: Get evidence thumbnail URLs
  const getEvidenceThumbnails = (evidenceIds) => {
    if (!evidenceIds || evidenceIds.length === 0) return []
    return evidenceIds.map(id => ({
      id,
      url: getEvidencePreviewUrl(id),
    }))
  }

  const openMediaModal = (url) => {
    setMediaModal({ url })
    setZoomLevel(1)
  }

  const closeMediaModal = () => {
    setMediaModal(null)
    setZoomLevel(1)
  }

  const formatTimestamp = (ts) => {
    if (!ts) return '—'
    const d = ts.toMillis ? new Date(ts.toMillis()) : new Date(ts)
    return d.toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
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
              filteredList.map(inc => {
                const thumbnails = getEvidenceThumbnails(inc.evidenceIds)
                return (
                  <div 
                    key={inc.id}
                    className={`inc-mgmt__card ${activeIncidentId === inc.id ? 'inc-mgmt__card--active' : ''}`}
                    onClick={() => setActiveIncidentId(inc.id)}
                  >
                    <div className="inc-mgmt__card-severity" style={{ background: getSeverityColor(inc.severity) }} />
                    <div className="inc-mgmt__card-info">
                      <div className="inc-mgmt__card-title">{inc.title}</div>
                      <div className="inc-mgmt__card-meta">
                        {inc.guardCode && <span className="inc-mgmt__card-guard">{inc.guardCode}</span>}
                        <span>{formatTimestamp(inc.createdAt)} • {inc.status}</span>
                      </div>
                    </div>
                    {/* Phase 19.1: Thumbnail preview in card */}
                    {thumbnails.length > 0 && (
                      <div className="inc-mgmt__card-thumb">
                        <img src={thumbnails[0].url} alt="Evidencia" loading="lazy" />
                      </div>
                    )}
                  </div>
                )
              })
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
                    <span className="inc-mgmt__badge" style={{ background: activeIncident.status === 'open' ? '#eab308' : '#22c55e', color: 'white' }}>
                      {activeIncident.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Phase 19.2: Guard Reporter Section */}
              <div className="inc-mgmt__reporter">
                <div className="inc-mgmt__reporter-label">Reportado por</div>
                <div className="inc-mgmt__reporter-info">
                  <span className="inc-mgmt__reporter-code">{activeIncident.guardCode || activeIncident.reportedBy?.slice(0, 8) || '—'}</span>
                  <span className="inc-mgmt__reporter-name">{activeIncident.guardName || 'Guardia no identificado'}</span>
                </div>
                {activeIncident.geofenceName && (
                  <div className="inc-mgmt__reporter-location">
                    📍 {activeIncident.geofenceName}{activeIncident.routeName ? ` · ${activeIncident.routeName}` : ''}
                  </div>
                )}
              </div>

              <div className="inc-mgmt__detail-desc">
                <strong>Descripción:</strong><br/><br/>
                {activeIncident.description || 'Sin descripción proporcionada.'}
              </div>

              {/* Phase 19.1: Evidence Gallery */}
              {activeIncident.evidenceIds && activeIncident.evidenceIds.length > 0 && (
                <div className="inc-mgmt__evidence">
                  <div className="inc-mgmt__evidence-title">📎 Evidencia ({activeIncident.evidenceIds.length})</div>
                  <div className="inc-mgmt__evidence-grid">
                    {getEvidenceThumbnails(activeIncident.evidenceIds).map(thumb => (
                      <div 
                        key={thumb.id}
                        className="inc-mgmt__evidence-item"
                        onClick={() => openMediaModal(thumb.url)}
                      >
                        <img src={thumb.url} alt="Evidencia" loading="lazy" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

      {/* Phase 19.1: Glassmorphic Media Modal */}
      {mediaModal && (
        <div className="inc-mgmt__media-overlay" onClick={closeMediaModal}>
          <div className="inc-mgmt__media-modal" onClick={(e) => e.stopPropagation()}>
            <div className="inc-mgmt__media-controls">
              <button onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}>−</button>
              <span>{Math.round(zoomLevel * 100)}%</span>
              <button onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))}>+</button>
              <button onClick={() => setZoomLevel(1)}>Reset</button>
              <button className="inc-mgmt__media-close" onClick={closeMediaModal}>✕</button>
            </div>
            <div className="inc-mgmt__media-container">
              <img 
                src={mediaModal.url} 
                alt="Evidencia ampliada"
                style={{ transform: `scale(${zoomLevel})` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
