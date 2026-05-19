import { useState, useEffect, useMemo, Fragment } from 'react'
import { useAuth } from '@/modules/auth/context/AuthContext'
import { createAssignment, subscribeToAllAssignments } from '@/modules/rondas/services/rondaAssignmentService'
import { getRoutes } from '@/modules/spatial/services/spatialService'
import { getAllUsers } from '@/modules/users/services/userService'
import { RONDA_STATES, STATE_LABELS, STATE_COLORS } from '@/modules/rondas/stateMachine/rondaStateMachine'
import { ROLES } from '@/config/roles'
import RondaAssignmentModal from '@/modules/admin/components/RondaAssignmentModal/RondaAssignmentModal'
import ActivityDatePicker from '@/components/ui/ActivityDatePicker/ActivityDatePicker'
import CustomSelect from '@/components/ui/CustomSelect/CustomSelect'
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

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [draftFilters, setDraftFilters] = useState({ search: '', from: '', to: '', routeId: '' })
  const [appliedFilters, setAppliedFilters] = useState({ search: '', from: '', to: '', routeId: '' })
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
  }, [filter, appliedFilters, groupByGuard, itemsPerPage])

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

  const getGuardInfo = (guardId) => {
    const g = guards.find(u => u.uid === guardId || u.id === guardId)
    if (!g) return { name: 'Desconocido', id: guardId?.slice(-6) || '—' }
    return { name: g.fullName || g.email, id: g.guardId || g.uid?.slice(-6) }
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

  const toLocalDateKey = (ts) => {
    const d = new Date(ts)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const activeDays = useMemo(() => {
    return new Set(assignments.map(a => {
      const ts = typeof a.scheduledStart === 'number' ? a.scheduledStart : a.scheduledStart?.toMillis?.() || 0
      return toLocalDateKey(ts)
    }))
  }, [assignments])

  const routeFilterOptions = useMemo(() => {
    return [
      { value: '', label: 'Todas las rutas' },
      ...routes.map(r => ({ value: r.id, label: r.name })),
    ]
  }, [routes])

  const pageSizeOptions = useMemo(() => {
    return [
      { value: 10, label: '10 rondas' },
      { value: 25, label: '25 rondas' },
      { value: 50, label: '50 rondas' },
      { value: 100, label: '100 rondas' },
    ]
  }, [])

  const filteredAssignments = useMemo(() => {
    let result = assignments.filter(a => {
      if (filter === 'ALL') return true
      if (filter === 'ACTIVE') return ['in_progress', 'paused', 'validating_voice'].includes(a.status)
      if (filter === 'PENDING') return ['available', 'pending'].includes(a.status) && !isVisuallyMissed(a)
      if (filter === 'COMPLETED') return ['completed', 'late'].includes(a.status)
      if (filter === 'MISSED') return ['missed', 'failed', 'cancelled'].includes(a.status) || isVisuallyMissed(a)
      return true
    })

    const { search, from, to, routeId } = appliedFilters

    if (routeId) {
      result = result.filter(a => a.routeId === routeId)
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(a => {
        const guardName = getGuardInfo(a.guardId).name.toLowerCase()
        const guardId = (a.guardId || '').toLowerCase()
        return guardName.includes(q) || guardId.includes(q)
      })
    }

    if (from) {
      const [y, m, d] = from.split('-')
      const startOfDayTs = new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
      result = result.filter(a => {
        const startTs = typeof a.scheduledStart === 'number' ? a.scheduledStart : a.scheduledStart?.toMillis?.() || 0
        return startTs >= startOfDayTs
      })
    }

    if (to) {
      const [y, m, d] = to.split('-')
      const endOfDayTs = new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
      result = result.filter(a => {
        const startTs = typeof a.scheduledStart === 'number' ? a.scheduledStart : a.scheduledStart?.toMillis?.() || 0
        return startTs <= endOfDayTs
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
  }, [assignments, filter, appliedFilters, guards])

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
      `"${getGuardInfo(a.guardId).name}"`,
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

  const applyFilters = () => {
    setAppliedFilters({ ...draftFilters })
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setDraftFilters({ search: '', from: '', to: '', routeId: '' })
    setAppliedFilters({ search: '', from: '', to: '', routeId: '' })
    setCurrentPage(1)
  }

  const renderTableRow = (a) => {
    const missed = isVisuallyMissed(a)
    const displayStatus = missed ? 'No Cumplida' : (STATE_LABELS[a.status] || a.status)
    const stateColor = missed ? '#ef4444' : (STATE_COLORS[a.status] || '#64748b')
    const guardInfo = getGuardInfo(a.guardId)
    return (
      <tr key={a.id} className={missed ? 'rondas-admin__row--missed' : ''}>
        <td className="rondas-admin__cell-guard">
          <div className="rondas-admin__guard-name">{guardInfo.name}</div>
          <div className="rondas-admin__guard-id">ID: {guardInfo.id}</div>
        </td>
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

        {/* Group by Guard Toggle */}
        <label className="rondas-admin__toggle-group">
          <input
            type="checkbox"
            checked={groupByGuard}
            onChange={(e) => setGroupByGuard(e.target.checked)}
          />
          <span className="rondas-admin__toggle-slider" />
          <span>Agrupar</span>
        </label>
      </div>

      {/* Toggle Advanced Filters */}
      <button
        className="rondas-admin__toggle-advanced"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? '▲ Ocultar Filtros' : '▼ Filtros Avanzados'}
      </button>

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div className="rondas-admin__advanced-panel">
          <div className="rondas-admin__advanced-row">
            {/* Search */}
            <div className="rondas-admin__advanced-field">
              <input
                type="text"
                className="rondas-admin__search-input"
                placeholder="Buscar por guardia o ID..."
                value={draftFilters.search}
                onChange={(e) => setDraftFilters(prev => ({ ...prev, search: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              />
            </div>

            {/* Date Range */}
            <div className="rondas-admin__advanced-field">
              <ActivityDatePicker
                value={draftFilters.from}
                onChange={(val) => setDraftFilters(prev => ({ ...prev, from: val }))}
                activeDates={activeDays}
                label="Desde"
              />
            </div>
            <div className="rondas-admin__advanced-field">
              <ActivityDatePicker
                value={draftFilters.to}
                onChange={(val) => setDraftFilters(prev => ({ ...prev, to: val }))}
                activeDates={activeDays}
                label="Hasta"
              />
            </div>

            {/* Route Filter */}
            <div className="rondas-admin__advanced-field">
              <CustomSelect
                value={draftFilters.routeId}
                onChange={(val) => setDraftFilters(prev => ({ ...prev, routeId: val }))}
                options={routeFilterOptions}
                placeholder="Filtrar por ruta..."
              />
            </div>

            {/* Actions */}
            <div className="rondas-admin__advanced-actions">
              <button className="rondas-admin__btn-search" onClick={applyFilters}>
                🔍 Buscar
              </button>
              <button className="rondas-admin__btn-clear" onClick={clearFilters}>
                ✕ Limpiar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: Export + Results Count */}
      <div className="rondas-admin__toolbar">
        <span className="rondas-admin__results-count">
          {filteredAssignments.length} resultado{filteredAssignments.length !== 1 ? 's' : ''}
          {totalPages > 1 && ` · Página ${currentPage} de ${totalPages}`}
        </span>
        <button className="rondas-admin__btn-export" onClick={exportToCSV}>
          📥 Exportar CSV
        </button>
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
                    <Fragment key={`group-fragment-${guardId}`}>
                      <tr className="rondas-admin__group-header">
                        <td colSpan={6}>
                          <span className="rondas-admin__group-name">
                            👤 {getGuardInfo(guardId).name}
                            <span className="rondas-admin__group-count">({guardAssignments.length})</span>
                          </span>
                        </td>
                      </tr>
                      {guardAssignments.map(a => renderTableRow(a))}
                    </Fragment>
                  ))
                ) : (
                  paginatedData.map(a => renderTableRow(a))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="rondas-admin__pagination">
            <div className="rondas-admin__pagination-left">
              <CustomSelect
                value={itemsPerPage}
                onChange={(val) => setItemsPerPage(Number(val))}
                options={pageSizeOptions}
                direction="up"
              />
            </div>

            <div className="rondas-admin__page-center">
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

            <div className="rondas-admin__pagination-right" />
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <RondaAssignmentModal
          guards={guards}
          routes={routes}
          existingAssignments={assignments}
          onSubmit={handleCreateAssignment}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
