import { useState, useEffect, useCallback, useMemo } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { subscribeToUsers, adminCreateUser, updateUserRole, toggleUserStatus } from '@/modules/users/services/userService'
import { ROLES } from '@/config/roles'
import { USER_STATUS } from '@/config/constants'
import { useAuth } from '@/modules/auth/context/AuthContext'
import CustomSelect from '../components/CustomSelect'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { createGuardIcon } from '@/modules/maps/utils/mapIcons'
import './UsersPage.css'

const ROLE_OPTIONS = [
  { value: ROLES.ADMIN, label: 'Administrador' },
  { value: ROLES.OPERATIONS_CHIEF, label: 'Jefe de Operaciones' },
  { value: ROLES.SUPERVISOR, label: 'Supervisor' },
  { value: ROLES.GUARD, label: 'Guardia' },
]

export default function UsersPage() {
  const { profile: currentUserProfile } = useAuth()
  const [users, setUsers] = useState([])
  const [presences, setPresences] = useState({}) // Maps guardId -> presence document
  const [loading, setLoading] = useState(true)
  
  // Default tab is Guards
  const [filterRole, setFilterRole] = useState(ROLES.GUARD)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const usersPerPage = 10

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [modalError, setModalError] = useState(null)

  // Map Modal State
  const [selectedLocation, setSelectedLocation] = useState(null) // { user, presence }

  // Create form state (added shiftStart and shiftEnd)
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: ROLES.GUARD,
    phone: '',
    guardId: '',
    shiftStart: '',
    shiftEnd: '',
  })

  // Real-time users subscription
  useEffect(() => {
    const unsubscribe = subscribeToUsers((data) => {
      setUsers(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  // Real-time guardPresence subscription
  useEffect(() => {
    const presenceRef = collection(db, 'guardPresence')
    const unsubPresence = onSnapshot(presenceRef, (snap) => {
      const presenceMap = {}
      snap.docs.forEach((doc) => {
        const data = doc.data()
        if (data.guardId) {
          presenceMap[data.guardId] = data
        }
      })
      setPresences(presenceMap)
    }, (err) => {
      console.error('Error fetching presences in UsersPage:', err)
    })
    return () => unsubPresence()
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

  const handleCreateSubmit = useCallback(async (e) => {
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
      setForm({ 
        fullName: '', 
        email: '', 
        password: '', 
        role: ROLES.GUARD, 
        phone: '', 
        guardId: '',
        shiftStart: '',
        shiftEnd: '' 
      })
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
  }, [form])

  // Filter creation roles for Operations Chief
  const availableRoleOptions = useMemo(() => {
    if (currentUserProfile?.role === ROLES.OPERATIONS_CHIEF) {
      return [
        { value: ROLES.SUPERVISOR, label: 'Supervisor' },
        { value: ROLES.GUARD, label: 'Guardia' },
      ]
    }
    return ROLE_OPTIONS
  }, [currentUserProfile?.role])

  // Reactively filter user list
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Tab role filter
      if (user.role !== filterRole) return false

      // Search query (only active for Guards and Supervisors)
      if (filterRole === ROLES.GUARD || filterRole === ROLES.SUPERVISOR) {
        if (!searchQuery) return true
        const queryLower = searchQuery.toLowerCase()
        return (
          (user.fullName || '').toLowerCase().includes(queryLower) ||
          (user.email || '').toLowerCase().includes(queryLower) ||
          (user.guardId || '').toLowerCase().includes(queryLower)
        )
      }
      return true
    })
  }, [users, filterRole, searchQuery])

  // Reset page when filter tab or search query changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filterRole, searchQuery])

  // Pagination calculation
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage) || 1
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * usersPerPage
    return filteredUsers.slice(startIndex, startIndex + usersPerPage)
  }, [filteredUsers, currentPage])

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
          <p className="users-page__subtitle">Control de roles, turnos y ubicación de guardias (RBAC)</p>
        </div>
        <button
          className="users-page__btn-create"
          onClick={() => {
            // Set default role matching available roles
            const defaultRole = currentUserProfile?.role === ROLES.OPERATIONS_CHIEF ? ROLES.SUPERVISOR : ROLES.GUARD
            setForm(f => ({ ...f, role: defaultRole }))
            setShowCreateModal(true)
          }}
        >
          + Nuevo Usuario
        </button>
      </div>

      <div className="users-page__content">
        {/* Navigation Tabbed Filters */}
        <div className="users-page__tabs">
          <button
            className={`users-page__tab-btn ${filterRole === ROLES.GUARD ? 'users-page__tab-btn--active' : ''}`}
            onClick={() => setFilterRole(ROLES.GUARD)}
          >
            Guardias
          </button>
          <button
            className={`users-page__tab-btn ${filterRole === ROLES.SUPERVISOR ? 'users-page__tab-btn--active' : ''}`}
            onClick={() => setFilterRole(ROLES.SUPERVISOR)}
          >
            Supervisores
          </button>
          <button
            className={`users-page__tab-btn ${filterRole === ROLES.OPERATIONS_CHIEF ? 'users-page__tab-btn--active' : ''}`}
            onClick={() => setFilterRole(ROLES.OPERATIONS_CHIEF)}
          >
            Jefes de Operaciones
          </button>
          <button
            className={`users-page__tab-btn ${filterRole === ROLES.ADMIN ? 'users-page__tab-btn--active' : ''}`}
            onClick={() => setFilterRole(ROLES.ADMIN)}
          >
            Administradores
          </button>
        </div>

        {/* Toolbar with reactive Search query */}
        <div className="users-page__toolbar">
          {(filterRole === ROLES.GUARD || filterRole === ROLES.SUPERVISOR) ? (
            <div className="users-page__search-wrapper">
              <span className="users-page__search-icon">🔍</span>
              <input
                type="text"
                placeholder="Buscar por nombre, correo o ID de guardia..."
                className="users-page__search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          ) : (
            <div className="users-page__search-placeholder">
              Búsqueda no requerida para este rol
            </div>
          )}
          <span className="users-page__count">{filteredUsers.length} usuarios encontrados</span>
        </div>

        {error && <div className="users-page__error-banner">{error}</div>}

        <div className="users-page__table-wrapper">
          <table className="users-page__table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Guard ID</th>
                <th>Horario Turno</th>
                <th>Último Acceso</th>
                <th>Última Ubicación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>Cargando usuarios...</td></tr>
              ) : paginatedUsers.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>No se encontraron usuarios en esta sección</td></tr>
              ) : (
                paginatedUsers.map(user => {
                  const presence = presences[user.id || user.uid]
                  const hasLocation = presence?.location?.lat != null && presence?.location?.lng != null
                  
                  // Security Check: operations chief cannot disable/modify roles of administrators
                  const isRestrictedAdminRow = currentUserProfile?.role === ROLES.OPERATIONS_CHIEF && user.role === ROLES.ADMIN

                  return (
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
                        <CustomSelect
                          value={user.role || ROLES.GUARD}
                          onChange={(newRole) => handleRoleChange(user.id, newRole)}
                          options={ROLE_OPTIONS}
                          disabled={isRestrictedAdminRow}
                          className="users-page__role-select-custom"
                        />
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
                        <span className="users-page__shift-hours">
                          {user.shiftStart && user.shiftEnd 
                            ? `${user.shiftStart} - ${user.shiftEnd}`
                            : 'No Asignado'
                          }
                        </span>
                      </td>
                      <td>
                        <span className="users-page__last-login">{formatDate(user.lastLogin)}</span>
                      </td>
                      <td>
                        {hasLocation ? (
                          <button
                            type="button"
                            className="users-page__btn-location"
                            onClick={() => setSelectedLocation({ user, presence })}
                          >
                            🗺️ Ver Ubicación
                          </button>
                        ) : (
                          <span className="users-page__no-location">Sin Señal GPS</span>
                        )}
                      </td>
                      <td>
                        <div className="users-page__actions">
                          <button
                            className={`users-page__btn-action users-page__btn-action--${user.status === USER_STATUS.ACTIVE ? 'deactivate' : 'activate'}`}
                            onClick={() => handleStatusToggle(user.id, user.status)}
                            disabled={isRestrictedAdminRow}
                          >
                            {user.status === USER_STATUS.ACTIVE ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="users-page__pagination">
            <span className="users-page__pagination-info">
              Mostrando {(currentPage - 1) * usersPerPage + 1} - {Math.min(currentPage * usersPerPage, filteredUsers.length)} de {filteredUsers.length} usuarios
            </span>
            <div className="users-page__pagination-controls">
              <button
                className="users-page__pagination-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                Anterior
              </button>
              <span className="users-page__pagination-current">Pág. {currentPage} de {totalPages}</span>
              <button
                className="users-page__pagination-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
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
                  <CustomSelect
                    value={form.role}
                    onChange={(val) => setForm({ ...form, role: val })}
                    options={availableRoleOptions}
                  />
                </div>

                <div className="users-page__modal-field">
                  <label>Guard ID (Código)</label>
                  <input
                    type="text"
                    placeholder="Ej: G-006"
                    value={form.guardId}
                    onChange={(e) => setForm({ ...form, guardId: e.target.value })}
                  />
                </div>
              </div>

              {/* Shift Hours inputs */}
              <div className="users-page__modal-row">
                <div className="users-page__modal-field">
                  <label>Inicio de Turno</label>
                  <input
                    type="time"
                    value={form.shiftStart}
                    onChange={(e) => setForm({ ...form, shiftStart: e.target.value })}
                  />
                </div>

                <div className="users-page__modal-field">
                  <label>Fin de Turno</label>
                  <input
                    type="time"
                    value={form.shiftEnd}
                    onChange={(e) => setForm({ ...form, shiftEnd: e.target.value })}
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

      {/* ─── Last Known Location Map Modal ─── */}
      {selectedLocation && (
        <LocationModal
          user={selectedLocation.user}
          presence={selectedLocation.presence}
          onClose={() => setSelectedLocation(null)}
        />
      )}
    </div>
  )
}

function LocationModal({ user, presence, onClose }) {
  if (!presence || !presence.location) return null
  const position = [presence.location.lat, presence.location.lng]
  const guardStatus = presence.status || 'offline'
  const guardName = user.fullName || presence.guardName || 'Desconocido'
  const guardCode = user.guardId || presence.guardCode || 'N/A'

  const statusMap = {
    online: 'Online',
    in_progress: 'En Ronda (Activo)',
    validating_voice: 'Validando Voz',
    offline: 'Offline'
  }

  const getIconState = (status) => {
    if (status === 'in_progress') return 'active'
    if (status === 'validating_voice') return 'alert'
    if (status === 'online') return 'tracking'
    return 'inactive'
  }

  const icon = createGuardIcon(getIconState(guardStatus))

  return (
    <div className="location-modal-overlay" onClick={onClose}>
      <div className="location-modal" onClick={e => e.stopPropagation()}>
        <div className="location-modal__header">
          <div>
            <h3>Ubicación en Tiempo Real</h3>
            <p className="location-modal__subtitle">Guardia: {guardName} ({guardCode})</p>
          </div>
          <button className="location-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="location-modal__body">
          <MapContainer
            center={position}
            zoom={16}
            scrollWheelZoom={true}
            style={{ height: '400px', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            <Marker position={position} icon={icon}>
              <Popup>
                <div style={{ color: '#fff', fontSize: '12px', lineHeight: '1.4' }}>
                  <strong style={{ display: 'block', fontSize: '13px', marginBottom: '2px' }}>{guardName}</strong>
                  <div>Código: {guardCode}</div>
                  <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: guardStatus === 'in_progress' ? '#22c55e' : (guardStatus === 'validating_voice' ? '#a855f7' : '#0055ff')
                    }} />
                    {statusMap[guardStatus] || guardStatus}
                  </div>
                  {presence.lastUpdate && (
                    <div style={{ fontSize: '10px', color: '#888', marginTop: '6px' }}>
                      Último reporte: {new Date(presence.lastUpdate.toMillis ? presence.lastUpdate.toMillis() : presence.lastUpdate).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        </div>
      </div>
    </div>
  )
}
