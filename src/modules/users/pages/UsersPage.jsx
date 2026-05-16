import { useState, useEffect, useCallback } from 'react'
import { subscribeToUsers, adminCreateUser, updateUserRole, toggleUserStatus } from '@/modules/users/services/userService'
import { ROLES } from '@/config/roles'
import { USER_STATUS } from '@/config/constants'
import './UsersPage.css'

const ROLE_OPTIONS = [
  { value: ROLES.ADMIN, label: 'Admin' },
  { value: ROLES.OPERATIONS_CHIEF, label: 'Jefe Ops' },
  { value: ROLES.SUPERVISOR, label: 'Supervisor' },
  { value: ROLES.GUARD, label: 'Guardia' },
]

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterRole, setFilterRole] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [modalError, setModalError] = useState(null)

  // Create form state
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: ROLES.GUARD,
    phone: '',
    guardId: '',
  })

  // Real-time subscription
  useEffect(() => {
    const unsubscribe = subscribeToUsers((data) => {
      setUsers(data)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleRoleChange = useCallback(async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole)
    } catch (err) {
      console.error('Failed to update role:', err)
      setError('Error al cambiar rol')
      setTimeout(() => setError(null), 3000)
    }
  }, [])

  const handleStatusToggle = useCallback(async (userId, currentStatus) => {
    try {
      await toggleUserStatus(userId, currentStatus)
    } catch (err) {
      console.error('Failed to toggle status:', err)
      setError('Error al cambiar estado')
      setTimeout(() => setError(null), 3000)
    }
  }, [])

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!form.fullName || !form.email || !form.password) {
      setModalError('Nombre, correo y contraseña son obligatorios')
      return
    }

    setCreating(true)
    setModalError(null)

    try {
      await adminCreateUser(form)
      setShowCreateModal(false)
      setForm({ fullName: '', email: '', password: '', role: ROLES.GUARD, phone: '', guardId: '' })
    } catch (err) {
      console.error('Create user error:', err)
      const msg = err.code === 'auth/email-already-in-use'
        ? 'El correo ya está registrado'
        : err.code === 'auth/weak-password'
        ? 'La contraseña debe tener al menos 6 caracteres'
        : 'Error al crear usuario'
      setModalError(msg)
    } finally {
      setCreating(false)
    }
  }

  const filteredUsers = filterRole === 'all' ? users : users.filter(u => u.role === filterRole)

  const getInitials = (name) => {
    if (!name) return '?'
    const parts = name.split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  const formatDate = (ts) => {
    if (!ts) return '—'
    const d = ts.toMillis ? new Date(ts.toMillis()) : new Date(ts)
    return d.toLocaleDateString('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="users-page" id="users-page">
      <div className="users-page__header">
        <div>
          <h1 className="users-page__title">Gestión de Personal</h1>
          <p className="users-page__subtitle">Control de roles, accesos y biometría (RBAC)</p>
        </div>
        <button
          className="users-page__btn-create"
          onClick={() => setShowCreateModal(true)}
        >
          + Nuevo Usuario
        </button>
      </div>

      <div className="users-page__content">
        <div className="users-page__toolbar">
          <select
            className="users-page__filter"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">Todos los roles</option>
            <option value={ROLES.GUARD}>Guardias</option>
            <option value={ROLES.SUPERVISOR}>Supervisores</option>
            <option value={ROLES.OPERATIONS_CHIEF}>Jefes de Operaciones</option>
            <option value={ROLES.ADMIN}>Administradores</option>
          </select>
          <span className="users-page__count">{filteredUsers.length} usuarios</span>
        </div>

        <div className="users-page__table-wrapper">
          <table className="users-page__table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Guard ID</th>
                <th>Biometría</th>
                <th>Último Acceso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>Cargando usuarios...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No se encontraron usuarios</td></tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className={user.status === USER_STATUS.INACTIVE ? 'users-page__row--inactive' : ''}>
                    <td>
                      <div className="users-page__user-cell">
                        <div className={`users-page__avatar ${user.status === USER_STATUS.INACTIVE ? 'users-page__avatar--inactive' : ''}`}>
                          {getInitials(user.fullName || user.email)}
                        </div>
                        <div className="users-page__user-info">
                          <span className="users-page__user-name">{user.fullName || 'Sin Nombre'}</span>
                          <span className="users-page__user-email">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        className="users-page__role-select"
                        value={user.role || ROLES.GUARD}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      >
                        {ROLE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`users-page__badge users-page__badge--status-${user.status === USER_STATUS.ACTIVE ? 'active' : 'inactive'}`}>
                        {user.status === USER_STATUS.ACTIVE ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <span className="users-page__guard-id">{user.guardId || '—'}</span>
                    </td>
                    <td>
                      {user.biometricEnrolled
                        ? <span className="users-page__bio users-page__bio--enrolled">✓ Enrollado</span>
                        : <span className="users-page__bio users-page__bio--pending">Pendiente</span>
                      }
                    </td>
                    <td>
                      <span className="users-page__last-login">{formatDate(user.lastLogin)}</span>
                    </td>
                    <td>
                      <div className="users-page__actions">
                        <button
                          className={`users-page__btn-action users-page__btn-action--${user.status === USER_STATUS.ACTIVE ? 'deactivate' : 'activate'}`}
                          onClick={() => handleStatusToggle(user.id, user.status)}
                        >
                          {user.status === USER_STATUS.ACTIVE ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Create User Modal ─── */}
      {showCreateModal && (
        <div className="users-page__modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="users-page__modal" onClick={(e) => e.stopPropagation()}>
            <div className="users-page__modal-header">
              <h2>Crear Nuevo Usuario</h2>
              <button className="users-page__modal-close" onClick={() => { setShowCreateModal(false); setModalError(null) }}>✕</button>
            </div>

            {modalError && (
              <div className="users-page__modal-error">{modalError}</div>
            )}

            <form onSubmit={handleCreateSubmit} className="users-page__modal-form">
              <div className="users-page__modal-field">
                <label>Nombre Completo *</label>
                <input
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                />
              </div>

              <div className="users-page__modal-field">
                <label>Correo Electrónico *</label>
                <input
                  type="email"
                  placeholder="guardia@catarseguridad.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <div className="users-page__modal-field">
                <label>Contraseña *</label>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>

              <div className="users-page__modal-row">
                <div className="users-page__modal-field">
                  <label>Rol</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    {ROLE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="users-page__modal-field">
                  <label>Guard ID</label>
                  <input
                    type="text"
                    placeholder="Ej: G-006"
                    value={form.guardId}
                    onChange={(e) => setForm({ ...form, guardId: e.target.value })}
                  />
                </div>
              </div>

              <div className="users-page__modal-field">
                <label>Teléfono</label>
                <input
                  type="tel"
                  placeholder="+591 70000000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div className="users-page__modal-actions">
                <button
                  type="button"
                  className="users-page__modal-btn users-page__modal-btn--cancel"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="users-page__modal-btn users-page__modal-btn--create"
                  disabled={creating}
                >
                  {creating ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
