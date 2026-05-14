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

/* ─── Geolocation ─── */
export const GPS_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
}
export const MAX_CHECKPOINT_DISTANCE_METERS = 20

/* ─── Ronda States ─── */
export const RONDA_STATUS = {
  PENDING: 'pending',
  AVAILABLE: 'available',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  LATE: 'late',
  MISSED: 'missed',
  CANCELLED: 'cancelled',
}

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
