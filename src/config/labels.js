/**
 * SentinelOps — Centralized Labels (i18n-ready)
 * All UI text strings in one place for future internationalization
 */

const es = {
  app: {
    name: 'SentinelOps',
    tagline: 'Plataforma Operativa de Monitoreo',
    welcome: 'Centro de Operaciones',
  },

  auth: {
    loginTitle: 'Acceso al Sistema',
    loginSubtitle: 'Plataforma Operativa Geoespacial',
    emailPlaceholder: 'Correo electrónico',
    passwordPlaceholder: 'Contraseña',
    loginButton: 'Ingresar',
    loggingIn: 'Verificando credenciales...',
    logoutButton: 'Cerrar Sesión',
    errorInvalidCredentials: 'Credenciales inválidas',
    errorGeneric: 'Error de autenticación',
  },

  roles: {
    admin: 'Administrador',
    operations_chief: 'Jefe de Operaciones',
    supervisor: 'Supervisor',
    guard: 'Guardia',
  },

  nav: {
    dashboard: 'Dashboard',
    monitoring: 'Monitoreo',
    rondas: 'Rondas',
    misRondas: 'Mis Rondas',
    users: 'Usuarios',
    routes: 'Rutas',
    checkpoints: 'Checkpoints',
    incidents: 'Incidentes',
    analytics: 'Analítica',
    attendance: 'Asistencia',
    settings: 'Configuración',
  },

  rondas: {
    title: 'Rondas',
    myRondas: 'Mis Rondas',
    pending: 'Pendiente',
    available: 'Disponible',
    inProgress: 'En Progreso',
    completed: 'Completada',
    late: 'Retrasada',
    missed: 'Perdida',
    cancelled: 'Cancelada',
    startRonda: 'Iniciar Ronda',
    nextCheckpoint: 'Siguiente Checkpoint',
    distance: 'Distancia',
    withinRange: 'Dentro del rango',
    outOfRange: 'Fuera de rango — acércate más',
    routeCompleted: 'Ruta completada correctamente',
    autoCompleted: 'Checkpoint completado automáticamente',
    timeRemaining: 'Tiempo restante',
    checkpointsProgress: 'completados',
  },

  incidents: {
    title: 'Incidentes',
    report: 'Reportar Incidente',
    security: 'Seguridad',
    maintenance: 'Mantenimiento',
    emergency: 'Emergencia',
    observation: 'Observación',
    severityLow: 'Bajo',
    severityMedium: 'Medio',
    severityHigh: 'Alto',
    severityCritical: 'Crítico',
  },

  monitoring: {
    title: 'Centro de Monitoreo',
    liveTracking: 'Seguimiento en Vivo',
    activeGuards: 'Guardias Activos',
    activeRondas: 'Rondas Activas',
    alerts: 'Alertas',
  },

  map: {
    guardLocation: 'Ubicación del guardia',
    activatingGps: 'Activando GPS...',
    locationDetected: 'Ubicación detectada',
    locationNotActive: 'Ubicación no activada',
    gpsNotSupported: 'Tu navegador no soporta geolocalización',
    gpsError: 'No se pudo obtener la ubicación',
  },

  common: {
    loading: 'Cargando...',
    error: 'Error',
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    edit: 'Editar',
    create: 'Crear',
    search: 'Buscar',
    filter: 'Filtrar',
    noData: 'Sin datos disponibles',
    confirm: 'Confirmar',
    back: 'Volver',
    next: 'Siguiente',
    active: 'Activo',
    inactive: 'Inactivo',
  },

  status: {
    online: 'En línea',
    offline: 'Fuera de línea',
    active: 'Activo',
    inactive: 'Inactivo',
  },
}

/**
 * Get label by dot-notation key
 * @param {string} key - e.g. 'auth.loginTitle'
 * @param {string} lang - Language code (future)
 * @returns {string}
 */
export function t(key) {
  const keys = key.split('.')
  let result = es

  for (const k of keys) {
    result = result?.[k]
    if (result === undefined) return key
  }

  return result
}

export default es
