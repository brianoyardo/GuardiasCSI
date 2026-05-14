import { simulatorRegistry } from './gpsSimulationEngine'
import { telemetryBufferService } from './telemetryBufferService'
import { eventBus } from '@/modules/intelligence/events/eventBus'
import { OPERATIONAL_EVENTS } from '@/modules/intelligence/events/eventTaxonomy'

export async function runValidationProtocol() {
  console.log('🚀 [Validation] INICIANDO PROTOCOLO DE VALIDACIÓN OPERACIONAL E2E')
  const results = {
    telemetry: {},
    stress: {},
    offline: {},
    detection: {},
    memory: {}
  }

  // Helper para esperar
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  // Test 1: Telemetry Flow
  console.log('--- 1. Validando Flujo de Telemetría ---')
  const g1 = simulatorRegistry.create('V-001', {
    routeGeometry: { type: 'LineString', coordinates: [[0,0], [1,1]] },
    speedKmh: 100,
    updateIntervalMs: 100
  })
  
  let pointsReceived = 0
  const sub1 = eventBus.subscribe(OPERATIONAL_EVENTS.GPS_POSITION_UPDATED, p => {
    if (p.guardId === 'V-001') pointsReceived++
  })

  g1.start()
  await wait(550) // Debería emitir ~5 puntos
  g1.pause()
  
  const bufferState = telemetryBufferService.buffer.get(g1.executionId)
  results.telemetry.emittedPoints = pointsReceived
  results.telemetry.bufferedPoints = bufferState ? bufferState.length : 0
  results.telemetry.flowSuccess = (pointsReceived === results.telemetry.bufferedPoints && pointsReceived > 0)
  
  console.log(`[Telemetry] Emitidos: ${pointsReceived}, en Buffer: ${results.telemetry.bufferedPoints}`)

  // Test 3: Offline-First
  console.log('--- 3. Validando Resiliencia Offline-First ---')
  telemetryBufferService.setOnlineStatus(false)
  g1.resume()
  await wait(550) // 5 puntos mas
  g1.pause()
  
  const offlineBufferState = telemetryBufferService.buffer.get(g1.executionId)
  results.offline.bufferedWhileOffline = offlineBufferState.length
  
  let flushedEventFired = false
  const sub2 = eventBus.subscribe(OPERATIONAL_EVENTS.TELEMETRY_FLUSHED, () => {
    flushedEventFired = true
  })
  
  // Try flush while offline (should do nothing)
  await telemetryBufferService.flush(g1.executionId)
  results.offline.preventedFlush = !flushedEventFired
  
  // Set online, force flush
  telemetryBufferService.setOnlineStatus(true)
  await telemetryBufferService.flush(g1.executionId)
  await wait(100) // Wait for flush async
  results.offline.recoveredFlush = flushedEventFired
  
  console.log(`[Offline] Prevenido: ${results.offline.preventedFlush}, Recuperado: ${results.offline.recoveredFlush}`)

  // Test 4: Detection Engine
  console.log('--- 4. Validando Detection Engine ---')
  let detectionFired = false
  const sub3 = eventBus.subscribe(OPERATIONAL_EVENTS.GPS_ANOMALY, p => {
    if (p.guardId === 'V-001') detectionFired = true
  })
  
  g1.triggerDrift(true) // Massive drift triggers speed/accuracy anomaly in detection engine
  g1.resume()
  await wait(250)
  results.detection.driftDetected = detectionFired
  g1.stop()
  console.log(`[Detection] Anomalía detectada: ${detectionFired}`)

  // Test 2: Stress Test (20 guards)
  console.log('--- 2. Validando Stress Test (20 guardias) ---')
  let startMem = performance.memory ? performance.memory.usedJSHeapSize : 0
  let stressPoints = 0
  const sub4 = eventBus.subscribe(OPERATIONAL_EVENTS.GPS_POSITION_UPDATED, () => stressPoints++)

  const stressGuards = []
  for (let i = 0; i < 20; i++) {
    const sim = simulatorRegistry.create(`STRESS-${i}`, {
      routeGeometry: { type: 'LineString', coordinates: [[0,0], [1,1]] },
      updateIntervalMs: 50
    })
    stressGuards.push(sim)
    sim.start()
  }

  await wait(2000) // Run 20 guards at 20fps for 2 seconds (expect ~800 points)
  
  results.stress.pointsProcessed = stressPoints
  console.log(`[Stress] Puntos procesados concurrentemente: ${stressPoints}`)

  // Test 6: Memory Leak & Cleanup Audit
  console.log('--- 6. Validando Memory Leaks ---')
  simulatorRegistry.destroyAll()
  telemetryBufferService.clearAll()
  
  await wait(100) // Allow GC hints
  let endMem = performance.memory ? performance.memory.usedJSHeapSize : 0
  
  results.memory.intervalsCleared = (telemetryBufferService.flushIntervals.size === 0)
  results.memory.simulatorsCleared = (simulatorRegistry.simulators.size === 0)
  results.memory.deltaMb = ((endMem - startMem) / 1024 / 1024).toFixed(2)

  console.log(`[Memory] Intervals cleared: ${results.memory.intervalsCleared}`)
  console.log(`[Memory] Simulators cleared: ${results.memory.simulatorsCleared}`)
  console.log(`[Memory] Memory Delta (MB): ${results.memory.deltaMb} MB`)

  // Cleanup testing subs
  sub1(); sub2(); sub3(); sub4();
  
  console.log('✅ PROTOCOLO FINALIZADO', results)
  return results
}
