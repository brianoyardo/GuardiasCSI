/**
 * SentinelOps — Application Constants
 * Centralized configuration values
 */

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'SentinelOps'

/* ─── Default Map Center (La Paz, Bolivia) ─── */
export const DEFAULT_MAP_CENTER = {
  lat: parseFloat(import.meta.env.VITE_DEFAULT_LAT) || -16.5,
  lng: parseFloat(import.meta.env.VITE_DEFAULT_LNG) || -68.15,
}
export const DEFAULT_MAP_ZOOM = 16

/* ─── CARTO Basemaps API Key ─── */
const CARTO_API_KEY = import.meta.env.VITE_CARTO_API_KEY || ''
const cartoKeyParam = CARTO_API_KEY ? `?key=${CARTO_API_KEY}` : ''

/* ─── Tile Providers (CARTO Voyager con API Key) ─── */
export const TILE_PROVIDERS = {
  carto_voyager: {
    url: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${cartoKeyParam}`,
    attribution: '&copy; <a href="https://carto.com">CARTO</a> &copy; <a href="https://openstreetmap.org">OSM</a>',
  },
  carto_dark: {
    url: `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png${cartoKeyParam}`,
    attribution: '&copy; <a href="https://carto.com">CARTO</a> &copy; <a href="https://openstreetmap.org">OSM</a>',
  },
  carto_light: {
    url: `https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png${cartoKeyParam}`,
    attribution: '&copy; <a href="https://carto.com">CARTO</a> &copy; <a href="https://openstreetmap.org">OSM</a>',
  },
}

/* ─── CARTO Vector Style URL (para uso futuro con MapLibre GL) ─── */
export const CARTO_VECTOR_STYLE_URL = CARTO_API_KEY
  ? `https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json?key=${CARTO_API_KEY}`
  : null

/* ─── Geolocation ─── */
export const GPS_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 10000,
}
export const MAX_CHECKPOINT_DISTANCE_METERS = 20
export const POSITION_SYNC_INTERVAL = 3000
/* ─── Ronda States ─── */
export const RONDA_STATUS = {
  PENDING: 'pending',
  AVAILABLE: 'available',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  LATE: 'late',
  MISSED: 'missed',
  CANCELLED: 'cancelled',
  VALIDATING_VOICE: 'validating_voice',
}

/* ─── Catar Seguridad Integral — Tipos de Patrullaje ─── */
export const PATROL_TYPES = {
  A_PIE: 'A_PIE',
  MOTORIZADO: 'MOTORIZADO',
}

/* ─── Catar Seguridad Integral — Estados de Reporte ─── */
export const REPORT_STATES = {
  S_N: 'S_N',       // Sin Novedad
  C_N: 'C_N',       // Con Novedad
  PENDIENTE: 'PENDIENTE',
  INCOMPLETO: 'INCOMPLETO',
}

/* ─── Catar Seguridad Integral — Tipos de Turno ─── */
export const SHIFT_TYPES = {
  DIURNO: 'DIURNO',
  NOCTURNO: 'NOCTURNO',
  PRIMER_TURNO: 'PRIMER_TURNO',
  SEGUNDO_TURNO: 'SEGUNDO_TURNO',
}

/* ─── Catar Seguridad Integral — Frases de Biometría de Voz ─── */
export const VOICE_PASSPHRASES = [
  'Guardia Operacional empezando ronda',
  'Verificación biométrica de voz activa',
  'SentinelOps control de presencia activado',
]

/* ─── Catar Seguridad Integral — Umbrales de Biometría ─── */
export const VOICE_CONFIDENCE_THRESHOLD = 0.75
export const VOICE_MAX_RETRIES = 3

/* ─── Incident Severity ─── */
export const INCIDENT_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
}

/* ─── Incident Types ─── */
export const INCIDENT_TYPES = {
  SECURITY: 'security',
  MAINTENANCE: 'maintenance',
  EMERGENCY: 'emergency',
  OBSERVATION: 'observation',
}

/* ─── User Status ─── */
export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
}

/* ─── Execution Status ─── */
export const EXECUTION_STATUS = {
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  LATE: 'late',
  ABANDONED: 'abandoned',
}

/* ─── Firestore Collection Names ─── */
export const COLLECTIONS = {
  USERS: 'users',
  ROLES: 'roles',
  CLIENTS: 'clients',
  LOCATIONS: 'locations',
  ROUTES: 'routes',
  CHECKPOINTS: 'checkpoints',
  RONDAS: 'rondas',
  RONDA_ASSIGNMENTS: 'rondaAssignments',
  RONDA_EXECUTIONS: 'rondaExecutions',
  CHECKPOINT_LOGS: 'checkpointLogs',
  INCIDENTS: 'incidents',
  NOTIFICATIONS: 'notifications',
  ATTENDANCE: 'attendance',
  DEVICES: 'devices',
  ACTIVITY_LOGS: 'activityLogs',
}

/* ─── Breakpoints (matches theme) ─── */
export const BREAKPOINTS = {
  MOBILE: 480,
  TABLET: 768,
  DESKTOP: 1024,
  WIDE: 1280,
  ULTRAWIDE: 1536,
}
