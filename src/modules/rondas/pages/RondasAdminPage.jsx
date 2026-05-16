import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/modules/auth/context/AuthContext'
import { createAssignment, getAllAssignments } from '@/modules/rondas/services/rondaAssignmentService'
import { getRoutes } from '@/modules/spatial/services/spatialService'
import { getAllUsers } from '@/modules/users/services/userService'
import { RONDA_STATES, STATE_LABELS, STATE_COLORS } from '@/modules/rondas/stateMachine/rondaStateMachine'
import { ROLES } from '@/config/roles'
import './RondasAdminPage.css'

export default function RondasAdminPage() {
  const { user } = useAuth()
  const [guards, setGuards] = useState([])
  const [routes, setRoutes] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Form state
  const [form, setForm] = useState({
    guardId: '',
    rondaId: '',
    routeId: '',
    scheduledStart: '',
    scheduledEnd: '',
    priority: 'normal',
    notes: '',
  })

  // Load data
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [guardsData, routesData, assignmentsData] = await Promise.all([
        getAllUsers({ role: ROLES.GUARD }),
        getRoutes(true),
        getAllAssignments(),
      ])
      setGuards(guardsData.filter(g => g.status === 'active'))
      setRoutes(routesData)
      setAssignments(assignmentsData)
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.guardId || !form.routeId || !form.scheduledStart) {
      setError('Complete todos los campos obligatorios')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const startTs = new Date(form.scheduledStart).getTime()
      const endTs = startTs + (90 * 60 * 1000) // Default 1.5h duration

      await createAssignment({
        guardId: form.guardId,
        rondaId: form.rondaId || form.routeId,
        routeId: form.routeId,
        scheduledStart: startTs,
        scheduledEnd: endTs,
        assignedBy: user.uid,
        priority: form.priority,
        notes: form.notes,
      })

      // Reset form
      setForm({ guardId: '', rondaId: '', routeId: '', scheduledStart: '', scheduledEnd: '', priority: 'normal', notes: '' })
      setError(null)

      // Refresh assignments
      const updated = await getAllAssignments()
      setAssignments(updated)
    } catch (err) {
      console.error('Error creating assignment:', err)
      setError('Error al crear asignación')
    } finally {
      setSubmitting(false)
    }
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

  const todayAssignments = assignments.filter(a => {
    if (!a.scheduledStart) return false
    const d = a.scheduledStart.toMillis ? new Date(a.scheduledStart.toMillis()) : new Date(a.scheduledStart)
    const today = new Date()
    return d.toDateString() === today.toDateString()
  })

  const allAssignments = assignments.length > todayAssignments.length ? assignments : todayAssignments

  return (
    <div className="rondas-admin" id="rondas-admin-page">
      <div className="rondas-admin__header">
        <div>
          <h1 className="rondas-admin__title">Gestión de Rondas</h1>
          <p className="rondas-admin__subtitle">Asignar patrullajes a guardias</p>
        </div>
      </div>

      {error && <div className="rondas-admin__error">{error}</div>}

      <div className="rondas-admin__layout">
        {/* ─── Assignment Form ─── */}
        <div className="rondas-admin__form-card">
          <h2 className="rondas-admin__form-title">Nueva Asignación</h2>

          <form onSubmit={handleSubmit} className="rondas-admin__form">
            <div className="rondas-admin__field">
              <label>Guardia *</label>
              <select
                value={form.guardId}
                onChange={(e) => setForm({ ...form, guardId: e.target.value })}
                required
              >
                <option value="">Seleccionar guardia...</option>
                {guards.map(g => (
                  <option key={g.id} value={g.uid || g.id}>
                    {g.fullName || g.email} {g.guardId ? `(${g.guardId})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="rondas-admin__field">
              <label>Ruta *</label>
              <select
                value={form.routeId}
                onChange={(e) => setForm({ ...form, routeId: e.target.value, rondaId: e.target.value })}
                required
              >
                <option value="">Seleccionar ruta...</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="rondas-admin__field">
              <label>Fecha y Hora Programada *</label>
              <input
                type="datetime-local"
                value={form.scheduledStart}
                onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })}
                required
              />
            </div>

            <div className="rondas-admin__row">
              <div className="rondas-admin__field">
                <label>Prioridad</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="low">Baja</option>
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>

              <div className="rondas-admin__field">
                <label>Notas</label>
                <input
                  type="text"
                  placeholder="Opcional..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            <button
              type="submit"
              className="rondas-admin__btn-submit"
              disabled={submitting}
            >
              {submitting ? 'Asignando...' : 'Asignar Ronda'}
            </button>
          </form>
        </div>

        {/* ─── Assignments Table ─── */}
        <div className="rondas-admin__table-card">
          <h2 className="rondas-admin__table-title">
            Asignaciones {todayAssignments.length > 0 && todayAssignments.length < assignments.length ? '(Hoy)' : '(Todas)'}
          </h2>

          {loading ? (
            <div className="rondas-admin__loading">Cargando asignaciones...</div>
          ) : allAssignments.length === 0 ? (
            <div className="rondas-admin__empty">No hay asignaciones registradas</div>
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
                  </tr>
                </thead>
                <tbody>
                  {allAssignments.map(a => {
                    const stateColor = STATE_COLORS[a.status] || '#64748b'
                    return (
                      <tr key={a.id}>
                        <td className="rondas-admin__cell-guard">{getGuardName(a.guardId)}</td>
                        <td>{getRouteName(a.routeId)}</td>
                        <td>{formatTimestamp(a.scheduledStart)}</td>
                        <td>
                          <span className={`rondas-admin__priority rondas-admin__priority--${a.priority}`}>
                            {a.priority === 'urgent' ? 'Urgente' : a.priority === 'high' ? 'Alta' : a.priority === 'low' ? 'Baja' : 'Normal'}
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
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
