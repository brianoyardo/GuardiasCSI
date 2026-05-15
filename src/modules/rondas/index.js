/**
 * SentinelOps — Rondas Module Public API
 * 
 * Architecture:
 *   stateMachine/   → Formal state transitions, events, business rules
 *   validators/     → GPS, checkpoint, temporal, geofence validation
 *   services/       → Firestore CRUD for rondas, assignments, executions
 *   hooks/          → useRondaExecution, useCheckpointValidation, useRondaTimer
 *   components/     → RondaCard
 *   pages/          → MisRondasPage, RondaExecutionPage
 */

// State Machine
export {
  RONDA_STATES,
  STATE_LABELS,
  STATE_COLORS,
  RONDA_EVENTS,
  canTransition,
  transition,
  getAllowedTransitions,
  isTerminalState,
  isActiveState,
  canBeStarted,
  isLate,
  shouldMarkMissed,
} from './stateMachine/rondaStateMachine'

// Validators
export {
  validateCheckpointProximity,
  validateCheckpointOrder,
  validateGPSAccuracy,
  validateGeofenceContainment,
  detectGPSAnomaly,
  validateTimeWindow,
  calculateProgress,
} from './validators/rondaValidators'

// Hooks
export { useRondaExecution } from './hooks/useRondaExecution'
export { useCheckpointValidation } from './hooks/useCheckpointValidation'
export { useRondaTimer } from './hooks/useRondaTimer'

// Components
export { default as RondaCard } from './components/RondaCard/RondaCard'

// Pages
export { default as MisRondasPage } from './pages/MisRondasPage'
export { default as RondaExecutionPage } from './pages/RondaExecutionPage'

// Services — Execution (Catar + Biometría)
export {
  startExecution,
  registerCheckpoint,
  updateExecutionPosition,
  transitionExecution,
  completeExecution,
  getExecution,
  getActiveExecutions,
  getHistoricalExecutions,
  getExecutionTelemetry,
  startVoiceValidation,
  recordVoiceValidation,
} from './services/rondaExecutionService'
