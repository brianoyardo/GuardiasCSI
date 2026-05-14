/**
 * SentinelOps — Event Taxonomy
 * Strict naming convention for all operational events.
 * 
 * Prevents magic strings and ensures the Event Bus and
 * downstream consumers (n8n, analytics) understand the payload.
 */

export const OPERATIONAL_EVENTS = {
  // Incident Lifecycle
  INCIDENT_REPORTED: 'INCIDENT_REPORTED',
  INCIDENT_CRITICAL: 'INCIDENT_CRITICAL',
  INCIDENT_RESOLVED: 'INCIDENT_RESOLVED',

  // Patrol Lifecycle
  PATROL_ASSIGNED: 'PATROL_ASSIGNED',
  PATROL_STARTED: 'PATROL_STARTED',
  PATROL_PAUSED: 'PATROL_PAUSED',
  PATROL_COMPLETED: 'PATROL_COMPLETED',
  PATROL_FAILED: 'PATROL_FAILED',
  
  // Compliance & Anomalies
  PATROL_DEVIATION: 'PATROL_DEVIATION', // Route deviation detected
  GUARD_INACTIVE: 'GUARD_INACTIVE', // No movement for > 5 mins
  GEOFENCE_EXIT: 'GEOFENCE_EXIT', // Left restricted or patrol zone
  GEOFENCE_ENTER: 'GEOFENCE_ENTER',
  CHECKPOINT_SKIPPED: 'CHECKPOINT_SKIPPED',
  GPS_ANOMALY: 'GPS_ANOMALY', // Accuracy > 100m or sudden jump

  // Attendance & Safety
  ATTENDANCE_CHECKIN: 'ATTENDANCE_CHECKIN',
  ATTENDANCE_CHECKOUT: 'ATTENDANCE_CHECKOUT',
  SOS_TRIGGERED: 'SOS_TRIGGERED', // Panic button
}
