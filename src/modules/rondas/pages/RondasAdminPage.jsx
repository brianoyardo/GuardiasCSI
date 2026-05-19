import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/modules/auth/context/AuthContext'
import { createAssignment, subscribeToAllAssignments } from '@/modules/rondas/services/rondaAssignmentService'
import { getRoutes } from '@/modules/spatial/services/spatialService'
import { getAllUsers } from '@/modules/users/services/userService'
import { RONDA_STATES, STATE_LABELS, STATE_COLORS } from '@/modules/rondas/stateMachine/rondaStateMachine'
import { ROLES } from '@/config/roles'
import RondaAssignmentModal from '@/modules/admin/components/RondaAssignmentModal/RondaAssignmentModal'
import './RondasAdminPage.css'

const MISSED_TOLERANCE_MS = 10 * 60 * 1000
const PRIORITY_WEIGHT = { urgent: 4, high: 3, normal: 2, low: 1 }

export default function RondasAdminPage() {
  const { user } = useAuth()
  const [guards, setGuards] = useState([])
  const [routes, setRoutes] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState('ALL')

  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [groupByGuard, setGroupByGuard] = useState(false)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

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

  useEffect(() => {
    setCurrentPage(1)
  }, [filter, searchQuery, dateRange, groupByGuard, itemsPerPage])

  const handleCreateAssignment = async (data, isBatch = false) => {
    if (isBatch && Array.isArray(data)) {
      await Promise.all(
        data.map(a => createAssignment({ ...a, assignedBy: user.uid }))
      )
    } else {
      await createAssignment({
        ...data,
        assignedBy: user.uid,
      })
    }
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

  const isVisuallyMissed = (a) => {
    if (!a.scheduledStart) return false
    const pendingStates = ['available', 'pending']
    if (!pendingStates.includes(a.status)) return false
    const startTs = typeof a.scheduledStart === 'number' ? a.scheduledStart : a.scheduledStart.toMillis?.() || 0
    return Date.now() > (startTs + MISSED_TOLERANCE_MS)
  }

  const filteredAssignments = useMemo(() => {
    let result = assignments.filter(a => {
      if (filter === 'ALL') return true
      if (filter === 'ACTIVE') return ['in_progress', 'paused', 'validating_voice'].includes(a.status)
      if (filter === 'PENDING') return ['available', 'pending'].includes(a.status) && !isVisuallyMissed(a)
      if (filter === 'COMPLETED') return ['completed', 'late'].includes(a.status)
      if (filter === 'MISSED') return ['missed', 'failed', 'cancelled'].includes(a.status) || isVisuallyMissed(a)
      return true
    })

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(a => {
        const guardName = getGuardName(a.guardId).toLowerCase()
        const guardId = (a.guardId || '').toLowerCase()
        return guardName.includes(q) || guardId.includes(q)
      })
    }

    if (dateRange.from) {
      const fromTs = new Date(dateRange.from).getTime()
      result = result.filter(a => {
        const startTs = typeof a.scheduledStart === 'number' ? a.scheduledStart : a.scheduledStart?.toMillis?.() || 0
        return startTs >= fromTs
      })
    }

    if (dateRange.to) {
      const toTs = new Date(dateRange.to).setHours(23, 59, 59, 999)
      result = result.filter(a => {
        const startTs = typeof a.scheduledStart === 'number' ? a.scheduledStart : a.scheduledStart?.toMillis?.() || 0
        return startTs <= toTs
      })
    }

    result.sort((a, b) => {
      const weightDiff = (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0)
      if (weightDiff !== 0) return weightDiff
      const startA = typeof a.scheduledStart === 'number' ? a.scheduledStart : a.scheduledStart?.toMillis?.() || 0
      const startB = typeof b.scheduledStart === 'number' ? b.scheduledStart : b.scheduledStart?.toMillis?.() || 0
      return startB - startA
    })

    return result
  }, [assignments, filter, searchQuery, dateRange, guards])

  const totalPages = Math.ceil(filteredAssignments.length / itemsPerPage)
  const paginatedData = filteredAssignments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const groupedData = useMemo(() => {
    if (!groupByGuard) return null
    const groups = {}
    paginatedData.forEach(a => {
      const key = a.guardId || 'unknown'
      if (!groups[key]) groups[key] = []
      groups[key].push(a)
    })
    return groups
  }, [paginatedData, groupByGuard])

  const exportToCSV = () => {
    const headers = ['Guardia', 'Ruta', 'Inicio Programado', 'Fin Real', 'Prioridad', 'Estado', 'Reloj Global']
    const rows = filteredAssignments.map(a => [
      `"${getGuardName(a.guardId)}"`,
      `"${getRouteName(a.routeId)}"`,
      `"${formatTimestamp(a.scheduledStart)}"`,
      `"${formatTimestamp(a.actualEnd)}"`,
      a.priority || 'normal',
      STATE_LABELS[a.status] || a.status,
      a.strictTimeSync ? 'Sí' : 'No'
    ])
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte_rondas_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const renderTableRow = (a) => {
    const missed = isVisuallyMissed(a)
    const displayStatus = missed ? 'No Cumplida' : (STATE_LABELS[a.status] || a.status)
    const stateColor = missed ? '#ef4444' : (STATE_COLORS[a.status] || '#64748b')
    return (
      <tr key={a.id} className={missed ? 'rondas-admin__row--missed' : ''}>
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
            {displayStatus}
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
  }

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
          { key: 'MISSED', label: '🚫 No Cumplidas' },
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

      {/* Advanced Filters Bar */}
      <div className="rondas-admin__advanced-filters">
        <div className="rondas-admin__filter-row">
          {/* Search */}
          <div className="rondas-admin__filter-group">
            <label className="rondas-admin__filter-label">Buscar Guardia</label>
            <input
              type="text"
              className="rondas-admin__search-input"
              placeholder="Nombre o ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Date Range */}
          <div className="rondas-admin__filter-group">
            <label className="rondas-admin__filter-label">Desde</label>
            <input
              type="date"
              className="rondas-admin__date-input"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
            />
          </div>
          <div className="rondas-admin__filter-group">
            <label className="rondas-admin__filter-label">Hasta</label>
            <input
              type="date"
              className="rondas-admin__date-input"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            />
          </div>

          {/* Items per page */}
          <div className="rondas-admin__filter-group">
            <label className="rondas-admin__filter-label">Por página</label>
            <select
              className="rondas-admin__select"
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="rondas-admin__filter-row rondas-admin__filter-row--actions">
          {/* Group by Guard Toggle */}
          <label className="rondas-admin__toggle-group">
            <input
              type="checkbox"
              checked={groupByGuard}
              onChange={(e) => setGroupByGuard(e.target.checked)}
            />
            <span className="rondas-admin__toggle-slider" />
            <span>Agrupar por Guardia</span>
          </label>

          {/* Export CSV */}
          <button className="rondas-admin__btn-export" onClick={exportToCSV}>
            📥 Exportar CSV
          </button>
        </div>
      </div>

      {/* Results count */}
      <div className="rondas-admin__results-count">
        {filteredAssignments.length} resultado{filteredAssignments.length !== 1 ? 's' : ''}
        {totalPages > 1 && ` · Página ${currentPage} de ${totalPages}`}
      </div>

      {/* Table */}
      {loading ? (
        <div className="rondas-admin__loading">Cargando asignaciones...</div>
      ) : filteredAssignments.length === 0 ? (
        <div className="rondas-admin__empty">No hay asignaciones en este filtro</div>
      ) : (
        <>
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
                {groupByGuard ? (
                  Object.entries(groupedData).map(([guardId, guardAssignments]) => (
                    <>
                      <tr key={`group-${guardId}`} className="rondas-admin__group-header">
                        <td colSpan={6}>
                          <span className="rondas-admin__group-name">
                            👤 {getGuardName(guardId)}
                            <span className="rondas-admin__group-count">({guardAssignments.length})</span>
                          </span>
                        </td>
                      </tr>
                      {guardAssignments.map(a => renderTableRow(a))}
                    </>
                  ))
                ) : (
                  paginatedData.map(a => renderTableRow(a))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="rondas-admin__pagination">
              <button
                className="rondas-admin__page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                ← Anterior
              </button>
              <div className="rondas-admin__page-numbers">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    className={`rondas-admin__page-number ${currentPage === page ? 'rondas-admin__page-number--active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                className="rondas-admin__page-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
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
