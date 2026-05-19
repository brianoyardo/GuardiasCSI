import { eventBus } from '@/modules/intelligence/events/eventBus'
import { OPERATIONAL_EVENTS } from '@/modules/intelligence/events/eventTaxonomy'
import * as turf from '@turf/turf'

const LOG_PREFIX = '[Simulator]'

class GPSSimulator {
  constructor(guardId, config = {}) {
    this.guardId = guardId
    this.executionId = config.executionId || `sim_${Date.now()}`
    
    // Config
    this.routeGeometry = config.routeGeometry // GeoJSON LineString
    this.speedKmh = config.speedKmh || 5 // 5 km/h walking speed
    this.updateIntervalMs = config.updateIntervalMs || 1000 // 1 second emit
    this.jitterMeters = config.jitterMeters || 3 // Random GPS noise

    // State
    this.intervalId = null
    this.totalDistanceKm = 0
    this.currentDistanceKm = 0
    this.isPaused = false
    this.isSignalLost = false
    this.isDrifting = false
    this.isFinished = false
    this.lastPoint = null

    this._initializeRoute()
  }

  _initializeRoute() {
    if (!this.routeGeometry || this.routeGeometry.type !== 'LineString') {
      console.error(`${LOG_PREFIX} Invalid route geometry for guard ${this.guardId}`)
      return
    }

    const routeLine = turf.lineString(this.routeGeometry.coordinates)
    this.totalDistanceKm = turf.length(routeLine, { units: 'kilometers' })
    // console.log(`${LOG_PREFIX} Guard ${this.guardId} initialized. Route length: ${this.totalDistanceKm.toFixed(2)} km`)
  }

  start() {
    if (this.intervalId) return
    if (this.isFinished) return

    // console.log(`${LOG_PREFIX} Guard ${this.guardId} started patrol.`)
    eventBus.publish(OPERATIONAL_EVENTS.SIMULATION_STARTED, { guardId: this.guardId, executionId: this.executionId })

    this.intervalId = setInterval(() => {
      this._tick()
    }, this.updateIntervalMs)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isFinished = true
    eventBus.publish(OPERATIONAL_EVENTS.SIMULATION_ENDED, { guardId: this.guardId, executionId: this.executionId })
    // console.log(`${LOG_PREFIX} Guard ${this.guardId} stopped patrol.`)
  }

  pause() {
    this.isPaused = true
    // console.log(`${LOG_PREFIX} Guard ${this.guardId} paused.`)
  }

  resume() {
    this.isPaused = false
    // console.log(`${LOG_PREFIX} Guard ${this.guardId} resumed.`)
  }

  dropSignal(isLost = true) {
    this.isSignalLost = isLost
    if (isLost) {
      // console.log(`${LOG_PREFIX} Guard ${this.guardId} lost GPS signal.`)
      eventBus.publish(OPERATIONAL_EVENTS.GPS_SIGNAL_LOST, { guardId: this.guardId, executionId: this.executionId })
    } else {
      // console.log(`${LOG_PREFIX} Guard ${this.guardId} regained GPS signal.`)
      eventBus.publish(OPERATIONAL_EVENTS.GPS_SIGNAL_RESTORED, { guardId: this.guardId, executionId: this.executionId })
    }
  }

  triggerDrift(isDrifting = true) {
    this.isDrifting = isDrifting
    // console.log(`${LOG_PREFIX} Guard ${this.guardId} drift mode: ${isDrifting}`)
  }

  triggerGeofenceExit(distanceMeters = 50) {
    if (!this.lastPoint) return
    const pt = turf.point([this.lastPoint.lng, this.lastPoint.lat])
    // Move point orthogonally by distanceMeters
    const destination = turf.destination(pt, distanceMeters / 1000, 90, { units: 'kilometers' })
    const coord = destination.geometry.coordinates
    
    const anomalyPoint = {
      lat: coord[1],
      lng: coord[0],
      timestamp: Date.now(),
      accuracy: 10,
      speed: 0
    }
    
    // console.log(`${LOG_PREFIX} Guard ${this.guardId} injected geofence exit anomaly.`)
    eventBus.publish(OPERATIONAL_EVENTS.GPS_POSITION_UPDATED, {
      guardId: this.guardId,
      executionId: this.executionId,
      point: anomalyPoint
    })
  }

  triggerIncident(type = 'Suspicious Activity') {
    if (!this.lastPoint) return
    eventBus.publish(OPERATIONAL_EVENTS.INCIDENT_REPORTED, {
      guardId: this.guardId,
      executionId: this.executionId,
      type,
      position: this.lastPoint,
      timestamp: Date.now()
    })
  }

  _tick() {
    if (this.isPaused || this.isFinished) return

    // Calculate distance to move based on speed and interval
    const hoursElapsed = this.updateIntervalMs / 1000 / 3600
    const distanceToMoveKm = this.speedKmh * hoursElapsed
    
    this.currentDistanceKm += distanceToMoveKm

    if (this.currentDistanceKm >= this.totalDistanceKm) {
      this.currentDistanceKm = this.totalDistanceKm
      this.stop()
    }

    // Get true point along line
    const routeLine = turf.lineString(this.routeGeometry.coordinates)
    const exactPoint = turf.along(routeLine, this.currentDistanceKm, { units: 'kilometers' })

    let lng = exactPoint.geometry.coordinates[0]
    let lat = exactPoint.geometry.coordinates[1]

    // Apply Drift Anomaly (massive deviation)
    if (this.isDrifting) {
      const randomBearing = Math.random() * 360
      const driftPoint = turf.destination(exactPoint, 0.1, randomBearing, { units: 'kilometers' }) // 100m drift
      lng = driftPoint.geometry.coordinates[0]
      lat = driftPoint.geometry.coordinates[1]
    } 
    // Apply Standard Jitter
    else if (this.jitterMeters > 0) {
      const randomBearing = Math.random() * 360
      const jitterKm = (Math.random() * this.jitterMeters) / 1000
      const jitterPoint = turf.destination(exactPoint, jitterKm, randomBearing, { units: 'kilometers' })
      lng = jitterPoint.geometry.coordinates[0]
      lat = jitterPoint.geometry.coordinates[1]
    }

    const payloadPoint = {
      lat,
      lng,
      timestamp: Date.now(),
      accuracy: this.isDrifting ? 150 : (Math.random() * 5 + 5), // 5-10m normal accuracy
      speed: this.speedKmh
    }

    this.lastPoint = payloadPoint

    if (this.isSignalLost) {
      // Do not emit points while signal is lost
      return
    }

    // Emit event
    eventBus.publish(OPERATIONAL_EVENTS.GPS_POSITION_UPDATED, {
      guardId: this.guardId,
      executionId: this.executionId,
      point: payloadPoint
    })
  }
  
  destroy() {
    this.stop()
  }
}

/**
 * Registry Pattern for managing multiple guards
 */
class SimulatorRegistry {
  constructor() {
    this.simulators = new Map()
  }

  create(guardId, config) {
    if (this.simulators.has(guardId)) {
      // console.warn(`${LOG_PREFIX} Simulator for guard ${guardId} already exists. Overwriting.`)
      this.simulators.get(guardId).destroy()
    }
    const simulator = new GPSSimulator(guardId, config)
    this.simulators.set(guardId, simulator)
    return simulator
  }

  get(guardId) {
    return this.simulators.get(guardId)
  }

  destroy(guardId) {
    const sim = this.simulators.get(guardId)
    if (sim) {
      sim.destroy()
      this.simulators.delete(guardId)
    }
  }

  destroyAll() {
    for (const [guardId, sim] of this.simulators.entries()) {
      sim.destroy()
    }
    this.simulators.clear()
  }
}

export const simulatorRegistry = new SimulatorRegistry()
