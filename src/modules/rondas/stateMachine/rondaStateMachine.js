/**
 * SentinelOps — Ronda State Machine
 * Formal state transitions with validation and business rules
 * 
 * This is the SINGLE SOURCE OF TRUTH for ronda lifecycle.
 * No component or service should transition states without going through this.
 * 
 * States represent the operational lifecycle:
 *   pending → available → in_progress → completed
 *                                     → paused → in_progress (resume)
 *                                     → late
 *                                     → failed
 *                       → cancelled
 *                       → missed (time window expired)
 */

// ─── State Definitions ───

export const RONDA_STATES = {
  PENDING: 'pending',
  AVAILABLE: 'available',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  LATE: 'late',
  MISSED: 'missed',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
  VALIDATING_VOICE: 'validating_voice',
}

export const STATE_LABELS = {
  [RONDA_STATES.PENDING]: 'Pendiente',
  [RONDA_STATES.AVAILABLE]: 'Disponible',
  [RONDA_STATES.IN_PROGRESS]: 'En Progreso',
  [RONDA_STATES.PAUSED]: 'Pausada',
  [RONDA_STATES.COMPLETED]: 'Completada',
  [RONDA_STATES.LATE]: 'Completada con Retraso',
  [RONDA_STATES.MISSED]: 'No Realizada',
  [RONDA_STATES.CANCELLED]: 'Cancelada',
  [RONDA_STATES.FAILED]: 'Fallida',
  [RONDA_STATES.VALIDATING_VOICE]: 'Validando Voz',
}

export const STATE_COLORS = {
  [RONDA_STATES.PENDING]: '#64748b',
  [RONDA_STATES.AVAILABLE]: '#3380ff',
  [RONDA_STATES.IN_PROGRESS]: '#22c55e',
  [RONDA_STATES.PAUSED]: '#f59e0b',
  [RONDA_STATES.COMPLETED]: '#16a34a',
  [RONDA_STATES.LATE]: '#f97316',
  [RONDA_STATES.MISSED]: '#ef4444',
  [RONDA_STATES.CANCELLED]: '#94a3b8',
  [RONDA_STATES.FAILED]: '#dc2626',
  [RONDA_STATES.VALIDATING_VOICE]: '#8b5cf6',
}

// ─── Terminal States ───

const TERMINAL_STATES = new Set([
  RONDA_STATES.COMPLETED,
  RONDA_STATES.LATE,
  RONDA_STATES.MISSED,
  RONDA_STATES.CANCELLED,
  RONDA_STATES.FAILED,
])

// ─── Allowed Transitions ───

const TRANSITIONS = {
  [RONDA_STATES.PENDING]: [
    RONDA_STATES.AVAILABLE,
    RONDA_STATES.CANCELLED,
    RONDA_STATES.VALIDATING_VOICE,
  ],
  [RONDA_STATES.AVAILABLE]: [
    RONDA_STATES.IN_PROGRESS,
    RONDA_STATES.MISSED,
    RONDA_STATES.CANCELLED,
    RONDA_STATES.VALIDATING_VOICE,
  ],
  [RONDA_STATES.IN_PROGRESS]: [
    RONDA_STATES.PAUSED,
    RONDA_STATES.COMPLETED,
    RONDA_STATES.LATE,
    RONDA_STATES.FAILED,
    RONDA_STATES.CANCELLED,
  ],
  [RONDA_STATES.PAUSED]: [
    RONDA_STATES.IN_PROGRESS,
    RONDA_STATES.CANCELLED,
    RONDA_STATES.FAILED,
  ],
  [RONDA_STATES.VALIDATING_VOICE]: [
    RONDA_STATES.IN_PROGRESS,
    RONDA_STATES.PENDING,
    RONDA_STATES.FAILED,
  ],
  // Terminal states: no transitions out
  [RONDA_STATES.COMPLETED]: [],
  [RONDA_STATES.LATE]: [],
  [RONDA_STATES.MISSED]: [],
  [RONDA_STATES.CANCELLED]: [],
  [RONDA_STATES.FAILED]: [],
}

// ─── Transition Events (audit trail) ───

export const RONDA_EVENTS = {
  ASSIGN: 'ronda.assigned',
  MAKE_AVAILABLE: 'ronda.available',
  START: 'ronda.started',
  PAUSE: 'ronda.paused',
  RESUME: 'ronda.resumed',
  COMPLETE: 'ronda.completed',
  COMPLETE_LATE: 'ronda.completed_late',
  MISS: 'ronda.missed',
  CANCEL: 'ronda.cancelled',
  FAIL: 'ronda.failed',
  CHECKPOINT_REACHED: 'checkpoint.reached',
  CHECKPOINT_VALIDATED: 'checkpoint.validated',
  CHECKPOINT_SKIPPED: 'checkpoint.skipped',
  GPS_UPDATE: 'gps.update',
  GEOFENCE_EXIT: 'geofence.exit',
  INCIDENT_REPORTED: 'incident.reported',
  VOICE_START: 'voice.validation_started',
  VOICE_PASS: 'voice.validation_passed',
  VOICE_FAIL: 'voice.validation_failed',
}

// ─── Public API ───

/**
 * Check if a state transition is valid
 * @param {string} currentState
 * @param {string} nextState
 * @returns {boolean}
 */
export function canTransition(currentState, nextState) {
  const allowed = TRANSITIONS[currentState]
  if (!allowed) return false
  return allowed.includes(nextState)
}

/**
 * Attempt a state transition
 * Returns the new state or throws if invalid
 * @param {string} currentState
 * @param {string} nextState
 * @param {object} [context] - Additional context for validation
 * @returns {{ state: string, event: string, timestamp: number }}
 * @throws {Error} If transition is not allowed
 */
export function transition(currentState, nextState, context = {}) {
  if (!canTransition(currentState, nextState)) {
    throw new Error(
      `Transición inválida: ${currentState} → ${nextState}. ` +
      `Transiciones permitidas: [${(TRANSITIONS[currentState] || []).join(', ')}]`
    )
  }

  // Determine the event name for the audit log
  const event = resolveEvent(currentState, nextState)

  return {
    state: nextState,
    previousState: currentState,
    event,
    timestamp: Date.now(),
    ...context,
  }
}

/**
 * Resolve the event name for a given transition
 */
function resolveEvent(from, to) {
  const eventMap = {
    [`${RONDA_STATES.PENDING}_${RONDA_STATES.AVAILABLE}`]: RONDA_EVENTS.MAKE_AVAILABLE,
    [`${RONDA_STATES.AVAILABLE}_${RONDA_STATES.IN_PROGRESS}`]: RONDA_EVENTS.START,
    [`${RONDA_STATES.IN_PROGRESS}_${RONDA_STATES.PAUSED}`]: RONDA_EVENTS.PAUSE,
    [`${RONDA_STATES.PAUSED}_${RONDA_STATES.IN_PROGRESS}`]: RONDA_EVENTS.RESUME,
    [`${RONDA_STATES.IN_PROGRESS}_${RONDA_STATES.COMPLETED}`]: RONDA_EVENTS.COMPLETE,
    [`${RONDA_STATES.IN_PROGRESS}_${RONDA_STATES.LATE}`]: RONDA_EVENTS.COMPLETE_LATE,
    [`${RONDA_STATES.AVAILABLE}_${RONDA_STATES.MISSED}`]: RONDA_EVENTS.MISS,
    [`${RONDA_STATES.IN_PROGRESS}_${RONDA_STATES.FAILED}`]: RONDA_EVENTS.FAIL,
    [`${RONDA_STATES.PENDING}_${RONDA_STATES.VALIDATING_VOICE}`]: RONDA_EVENTS.VOICE_START,
    [`${RONDA_STATES.AVAILABLE}_${RONDA_STATES.VALIDATING_VOICE}`]: RONDA_EVENTS.VOICE_START,
    [`${RONDA_STATES.VALIDATING_VOICE}_${RONDA_STATES.IN_PROGRESS}`]: RONDA_EVENTS.VOICE_PASS,
    [`${RONDA_STATES.VALIDATING_VOICE}_${RONDA_STATES.PENDING}`]: RONDA_EVENTS.VOICE_FAIL,
    [`${RONDA_STATES.VALIDATING_VOICE}_${RONDA_STATES.FAILED}`]: RONDA_EVENTS.VOICE_FAIL,
  }

  return eventMap[`${from}_${to}`] || RONDA_EVENTS.CANCEL
}

/**
 * Get allowed next states from current state
 * @param {string} currentState
 * @returns {string[]}
 */
export function getAllowedTransitions(currentState) {
  return TRANSITIONS[currentState] || []
}

/**
 * Check if a state is terminal (no further transitions)
 * @param {string} state
 * @returns {boolean}
 */
export function isTerminalState(state) {
  return TERMINAL_STATES.has(state)
}

/**
 * Check if a ronda is in an active state (requires monitoring)
 * @param {string} state
 * @returns {boolean}
 */
export function isActiveState(state) {
  return state === RONDA_STATES.IN_PROGRESS || state === RONDA_STATES.PAUSED
}

/**
 * Check if a ronda can be started by a guard
 * @param {string} state
 * @returns {boolean}
 */
export function canBeStarted(state) {
  return state === RONDA_STATES.AVAILABLE || state === RONDA_STATES.VALIDATING_VOICE
}

/**
 * Check if a ronda requires voice validation before starting
 * @param {string} state
 * @returns {boolean}
 */
export function requiresVoiceValidation(state) {
  return state === RONDA_STATES.VALIDATING_VOICE
}

/**
 * Calculate whether a ronda should be marked as late
 * @param {number} scheduledEndTime - Unix timestamp
 * @param {number} [now] - Current time
 * @returns {boolean}
 */
export function isLate(scheduledEndTime, now = Date.now()) {
  return now > scheduledEndTime
}

/**
 * Calculate whether a ronda's time window has expired (missed)
 * @param {number} windowEndTime
 * @param {string} currentState
 * @param {number} [now]
 * @returns {boolean}
 */
export function shouldMarkMissed(windowEndTime, currentState, now = Date.now()) {
  return (
    now > windowEndTime &&
    (currentState === RONDA_STATES.PENDING || currentState === RONDA_STATES.AVAILABLE)
  )
}
