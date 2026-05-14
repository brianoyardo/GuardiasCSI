import { useState, useEffect } from 'react'
import { getAllUsers, updateUserProfile } from '@/modules/users/services/userService'
import { ROLES } from '@/config/roles'
import { USER_STATUS } from '@/config/constants'
import './UsersPage.css'

/**
 * UsersPage — Admin view for managing users
 * 
 * Synchronizes roles and statuses which affect RBAC.
 */
export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterRole, setFilterRole] = useState('all')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await getAllUsers()
      setUsers(data)
    } catch (err) {
      console.error('Failed to load users:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateUserProfile(userId, { role: newRole })
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } catch (err) {
      console.error('Failed to update role:', err)
    }
  }

  const handleStatusToggle = async (userId, currentStatus) => {
    const newStatus = currentStatus === USER_STATUS.ACTIVE ? USER_STATUS.INACTIVE : USER_STATUS.ACTIVE
    try {
      await updateUserProfile(userId, { status: newStatus })
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u))
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  const filteredUsers = filterRole === 'all' ? users : users.filter(u => u.role === filterRole)

  const getRoleBadgeClass = (role) => {
    if (role === ROLES.ADMIN) return 'users-page__badge--role-admin'
    if (role === ROLES.OPERATIONS_CHIEF) return 'users-page__badge--role-ops'
    if (role === ROLES.SUPERVISOR) return 'users-page__badge--role-sup'
    return 'users-page__badge--role-guard'
  }

  const getRoleLabel = (role) => {
    if (role === ROLES.ADMIN) return 'Admin'
    if (role === ROLES.OPERATIONS_CHIEF) return 'Ops Chief'
    if (role === ROLES.SUPERVISOR) return 'Supervisor'
    return 'Guardia'
  }

  const getInitials = (name) => {
    if (!name) return '?'
    const parts = name.split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div className="users-page" id="users-page">
      <div className="users-page__header">
        <div>
          <h1 className="users-page__title">Gestión de Usuarios</h1>
          <p className="users-page__subtitle">Control de roles y accesos (RBAC)</p>
        </div>
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
        </div>

        <div className="users-page__table-wrapper">
          <table className="users-page__table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Último Acceso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>Cargando...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No se encontraron usuarios</td></tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div className="users-page__user-cell">
                        <div className="users-page__avatar">{getInitials(user.fullName || user.email)}</div>
                        <div className="users-page__user-info">
                          <span className="users-page__user-name">{user.fullName || 'Sin Nombre'}</span>
                          <span className="users-page__user-email">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select 
                        className="users-page__filter"
                        style={{ padding: '4px 8px' }}
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      >
                        <option value={ROLES.GUARD}>Guardia</option>
                        <option value={ROLES.SUPERVISOR}>Supervisor</option>
                        <option value={ROLES.OPERATIONS_CHIEF}>Jefe Ops</option>
                        <option value={ROLES.ADMIN}>Admin</option>
                      </select>
                    </td>
                    <td>
                      <span className={`users-page__badge users-page__badge--status-${user.status === USER_STATUS.ACTIVE ? 'active' : 'inactive'}`}>
                        {user.status === USER_STATUS.ACTIVE ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      {user.lastLogin ? new Date(user.lastLogin.toMillis?.() || Date.now()).toLocaleDateString('es-BO') : 'Nunca'}
                    </td>
                    <td>
                      <div className="users-page__actions">
                        <button 
                          className="users-page__btn-action"
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
    </div>
  )
}
