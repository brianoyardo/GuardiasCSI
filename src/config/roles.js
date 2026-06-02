/**
 * SentinelOps — Roles & Permissions System
 * Granular RBAC for the entire platform
 */

export const ROLES = {
  ADMIN: 'admin',
  OPERATIONS_CHIEF: 'operations_chief',
  SUPERVISOR: 'supervisor',
  GUARD: 'guard',
}

/**
 * Human-readable role labels (i18n-ready)
 */
export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.OPERATIONS_CHIEF]: 'Jefe de Operaciones',
  [ROLES.SUPERVISOR]: 'Supervisor',
  [ROLES.GUARD]: 'Guardia',
}

/**
 * Permission definitions per role
 * Wildcard '*' grants all permissions
 */
export const PERMISSIONS = {
  [ROLES.ADMIN]: ['*'],
  [ROLES.OPERATIONS_CHIEF]: [
    'dashboard:read',
    'users:read',
    'guards:read',
    'guards:manage',
    'rondas:read',
    'rondas:assign',
    'rondas:manage',
    'routes:read',
    'routes:manage',
    'checkpoints:read',
    'checkpoints:manage',
    'monitoring:read',
    'monitoring:full',
    'incidents:read',
    'incidents:manage',
    'maps:full',
    'analytics:read',
    'attendance:read',
    'notifications:send',
  ],
  [ROLES.SUPERVISOR]: [
    'dashboard:read',
    'rondas:read',
    'monitoring:read',
    'incidents:read',
    'maps:read',
    'guards:read',
    'checkpoints:read',
    'attendance:read',
  ],
  [ROLES.GUARD]: [
    'rondas:own',
    'checkpoints:complete',
    'incidents:create',
    'attendance:own',
    'maps:own',
  ],
}

/**
 * Default redirect path per role after login
 */
export const ROLE_DEFAULT_ROUTES = {
  [ROLES.ADMIN]: '/admin/dashboard',
  [ROLES.OPERATIONS_CHIEF]: '/ops/monitoring',
  [ROLES.SUPERVISOR]: '/supervisor/monitoring',
  [ROLES.GUARD]: '/guard/mis-rondas',
}

/**
 * Check if a role has a specific permission
 * @param {string} role - User role
 * @param {string} permission - Permission to check
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  const rolePermissions = PERMISSIONS[role]
  if (!rolePermissions) return false
  if (rolePermissions.includes('*')) return true
  return rolePermissions.includes(permission)
}

/**
 * Check if a role has ANY of the given permissions
 * @param {string} role
 * @param {string[]} permissions
 * @returns {boolean}
 */
export function hasAnyPermission(role, permissions) {
  return permissions.some((perm) => hasPermission(role, perm))
}

/**
 * Get navigation items for a given role
 * Used by Sidebar to render appropriate menu items
 */
export function getNavigationForRole(role) {
  const navItems = {
    [ROLES.ADMIN]: [
      { id: 'dashboard', label: 'Dashboard', icon: 'grid', path: '/admin/dashboard' },
      { id: 'monitoring', label: 'Monitoreo', icon: 'radar', path: '/admin/monitoring' },
      { id: 'rondas', label: 'Rondas', icon: 'route', path: '/admin/rondas' },
      { id: 'users', label: 'Usuarios', icon: 'users', path: '/admin/users' },
      { id: 'spatial', label: 'Editor GIS', icon: 'map', path: '/admin/spatial' },
      { id: 'incidents', label: 'Incidentes', icon: 'alert', path: '/admin/incidents' },
      { id: 'analytics', label: 'Analítica', icon: 'chart', path: '/admin/analytics' },
      { id: 'reports', label: 'Reportes', icon: 'reports', path: '/admin/reports' },
    ],
    [ROLES.OPERATIONS_CHIEF]: [
      { id: 'monitoring', label: 'Monitoreo', icon: 'radar', path: '/ops/monitoring' },
      { id: 'rondas', label: 'Rondas', icon: 'route', path: '/ops/rondas' },
      { id: 'users', label: 'Usuarios', icon: 'users', path: '/ops/users' },
      { id: 'incidents', label: 'Incidentes', icon: 'alert', path: '/ops/incidents' },
      { id: 'analytics', label: 'Analítica', icon: 'chart', path: '/ops/analytics' },
      { id: 'reports', label: 'Reportes', icon: 'reports', path: '/ops/reports' },
    ],
    [ROLES.SUPERVISOR]: [
      { id: 'monitoring', label: 'Monitoreo', icon: 'radar', path: '/supervisor/monitoring' },
      { id: 'rondas', label: 'Rondas', icon: 'route', path: '/supervisor/rondas' },
      { id: 'incidents', label: 'Incidentes', icon: 'alert', path: '/supervisor/incidents' },
    ],
    [ROLES.GUARD]: [
      { id: 'mis-rondas', label: 'Mis Rondas', icon: 'route', path: '/guard/mis-rondas' },
      { id: 'incidents', label: 'Reportar', icon: 'alert', path: '/guard/incidents' },
    ],
  }

  return navItems[role] || []
}
