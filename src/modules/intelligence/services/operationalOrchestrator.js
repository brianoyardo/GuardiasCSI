import { eventBus } from '@/modules/intelligence/events/eventBus'
import { OPERATIONAL_EVENTS } from '@/modules/intelligence/events/eventTaxonomy'
import { telemetryBufferService } from '@/modules/guard-simulator/services/telemetryBufferService'
import { detectionEngine } from '@/modules/intelligence/services/detectionEngine'

const LOG_PREFIX = '[Orchestrator]'

/**
 * SentinelOps — Operational Orchestrator
 * Glues the decoupled EventBus with the Backend Services (Persistence and Intelligence).
 */
class OperationalOrchestrator {
  constructor() {
    this.isListening = false
    this.subscriptions = []
  }

  start() {
    if (this.isListening) return
    
    console.log(`${LOG_PREFIX} Starting Operational Orchestrator...`)
    
    // Subscribe to GPS updates
    const gpsSub = eventBus.subscribe(OPERATIONAL_EVENTS.GPS_POSITION_UPDATED, (payload) => {
      this.handleGpsUpdate(payload)
    })
    
    const anomalySub = eventBus.subscribe(OPERATIONAL_EVENTS.GPS_ANOMALY, (payload) => {
      console.warn(`${LOG_PREFIX} Detected GPS Anomaly for Guard ${payload.guardId}: ${payload.reason}`)
    })

    const inactiveSub = eventBus.subscribe(OPERATIONAL_EVENTS.GUARD_INACTIVE, (payload) => {
      console.warn(`${LOG_PREFIX} Guard ${payload.guardId} is INACTIVE. Distance moved: ${payload.distanceMovedMeters.toFixed(1)}m in ${payload.inactiveMinutes.toFixed(1)}min`)
    })

    const simStartSub = eventBus.subscribe(OPERATIONAL_EVENTS.SIMULATION_STARTED, (payload) => {
      console.log(`${LOG_PREFIX} Simulation started for ${payload.guardId} (Execution: ${payload.executionId})`)
    })

    const simEndSub = eventBus.subscribe(OPERATIONAL_EVENTS.SIMULATION_ENDED, (payload) => {
      console.log(`${LOG_PREFIX} Simulation ended for ${payload.guardId}. Clearing buffer...`)
      telemetryBufferService.flush(payload.executionId) // Force final flush
      setTimeout(() => {
        telemetryBufferService.clear(payload.executionId)
        detectionEngine.clearGuard(payload.guardId)
      }, 5000) // allow flush to finish
    })

    this.subscriptions.push(gpsSub, anomalySub, inactiveSub, simStartSub, simEndSub)
    this.isListening = true
  }

  handleGpsUpdate(payload) {
    const startTime = performance.now()
    const { guardId, executionId, point } = payload
    
    // 1. Forward to Intelligence Engine (Realtime)
    detectionEngine.processGpsUpdate(guardId, executionId, point)

    // 2. Forward to Persistence Buffer (Batching / Offline Support)
    telemetryBufferService.enqueue(guardId, executionId, point)
    
    const latencyMs = performance.now() - startTime
    if (latencyMs > 10) {
      console.warn(`${LOG_PREFIX} [EventBus] High latency processing GPS point: ${latencyMs.toFixed(2)}ms`)
    }
  }

  stop() {
    console.log(`${LOG_PREFIX} Stopping Operational Orchestrator...`)
    this.subscriptions.forEach(unsubscribe => unsubscribe())
    this.subscriptions = []
    this.isListening = false
  }
}

export const operationalOrchestrator = new OperationalOrchestrator()
