import { useState, useEffect } from 'react'
import { useAuth } from '@/modules/auth/context/AuthContext'
import { createAssignment, subscribeToAllAssignments } from '@/modules/rondas/services/rondaAssignmentService'
import { getRoutes } from '@/modules/spatial/services/spatialService'
import { getAllUsers } from '@/modules/users/services/userService'
import { RONDA_STATES, STATE_LABELS, STATE_COLORS } from '@/modules/rondas/stateMachine/rondaStateMachine'
import { ROLES } from '@/config/roles'
import RondaAssignmentModal from '@/modules/admin/components/RondaAssignmentModal/RondaAssignmentModal'
import './RondasAdminPage.css'

export default function RondasAdminPage() {
  const { user } = useAuth()
  const [guards, setGuards] = useState([])
  const [routes, setRoutes] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState('ALL')

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true)
      try {
        const [guardsData, routesData] = await Promise.all([
          getAllUsers({ role: ROLES.GUARD }),
          getRoutes(true),
        ])
        setGuards(guardsData.filter(g => g.status === 'active'))
        setRoutes(routesData)
      } catch (err) {
        console.error('Error loading data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadInitialData()
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeToAllAssignments((data) => {
      setAssignments(data)
    })
    return () => unsubscribe()
  }, [])

  const handleCreateAssignment = async (data) => {
    await createAssignment({
      ...data,
      assignedBy: user.uid,
    })
    setShowModal(false)
  }

  const formatTimestamp = (ts) => {
    if (!ts) return '—'
    const d = ts.toMillis ? new Date(ts.toMillis()) : new Date(ts)
    return d.toLocaleString('es-BO', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getGuardName = (guardId) => {
    const g = guards.find(u => u.uid === guardId || u.id === guardId)
    return g ? (g.fullName || g.email) : guardId?.slice(-6) || '—'
  }

  const getRouteName = (routeId) => {
    const r = routes.find(rt => rt.id === routeId)
    return r ? r.name : routeId?.slice(-8) || '—'
  }

  const filteredAssignments = assignments.filter(a => {
    if (filter === 'ALL') return true
    if (filter === 'ACTIVE') return ['in_progress', 'paused', 'validating_voice'].includes(a.status)
    if (filter === 'PENDING') return ['available', 'pending'].includes(a.status)
    if (filter === 'COMPLETED') return ['completed', 'late', 'failed', 'cancelled'].includes(a.status)
    return true
  })

  return (
    <div className="rondas-admin" id="rondas-admin-page">
      {/* Header */}
      <div className="rondas-admin__header">
        <div>
          <h1 className="rondas-admin__title">Gestión de Rondas</h1>
          <p className="rondas-admin__subtitle">Asignar y monitorear patrullajes</p>
        </div>
        <button className="rondas-admin__btn-create" onClick={() => setShowModal(true)}>
          ➕ Asignar Nueva Ronda
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="rondas-admin__filters">
        {[
          { key: 'ALL', label: 'Todas' },
          { key: 'ACTIVE', label: '🔴 En Curso' },
          { key: 'PENDING', label: '⏳ Pendientes' },
          { key: 'COMPLETED', label: '✓ Completadas' },
        ].map(f => (
          <button
            key={f.key}
            className={`rondas-admin__filter-btn ${filter === f.key ? 'rondas-admin__filter-btn--active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="rondas-admin__loading">Cargando asignaciones...</div>
      ) : filteredAssignments.length === 0 ? (
        <div className="rondas-admin__empty">No hay asignaciones en este filtro</div>
      ) : (
        <div className="rondas-admin__table-wrapper">
          <table className="rondas-admin__table">
            <thead>
              <tr>
                <th>Guardia</th>
                <th>Ruta</th>
                <th>Hora Programada</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Reloj Global</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.map(a => {
                const stateColor = STATE_COLORS[a.status] || '#64748b'
                return (
                  <tr key={a.id}>
                    <td className="rondas-admin__cell-guard">{getGuardName(a.guardId)}</td>
                    <td>{getRouteName(a.routeId)}</td>
                    <td>{formatTimestamp(a.scheduledStart)}</td>
                    <td>
                      <span className={`rondas-admin__priority rondas-admin__priority--${a.priority}`}>
                        {a.priority === 'urgent' ? '🔴 Urgente' : a.priority === 'high' ? '🟠 Alta' : a.priority === 'low' ? '🟢 Baja' : '🔵 Normal'}
                      </span>
                    </td>
                    <td>
                      <span
                        className="rondas-admin__status-badge"
                        style={{ background: `${stateColor}22`, color: stateColor, borderColor: `${stateColor}44` }}
                      >
                        {STATE_LABELS[a.status] || a.status}
                      </span>
                    </td>
                    <td>
                      {a.strictTimeSync ? (
                        <span className="rondas-admin__sync-badge">🌐 Activo</span>
                      ) : (
                        <span className="rondas-admin__sync-badge rondas-admin__sync-badge--off">Local</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <RondaAssignmentModal
          guards={guards}
          routes={routes}
          onSubmit={handleCreateAssignment}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
