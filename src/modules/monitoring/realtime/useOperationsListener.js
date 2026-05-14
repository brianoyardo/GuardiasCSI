import { useEffect, useRef, useCallback } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS } from '@/config/constants'
import useMonitoringStore from '@/stores/monitoringStore'
import useIncidentStore from '@/stores/incidentStore'
import { RONDA_STATES } from '@/modules/rondas/stateMachine/rondaStateMachine'

/**
 * SentinelOps — Realtime Operations Listener
 * Subscribes to Firestore streams and feeds Zustand stores
 * 
 * Architecture:
 *   Firestore onSnapshot → this listener → Zustand stores → UI re-renders
 * 
 * NO UI logic here. Only data flow.
 * Swappable for Socket.IO/MQTT in the future.
 * 
 * Usage: Call useOperationsListener() once in the monitoring layout/page.
 */

const LOG_PREFIX = '[RealtimeOps]'

export function useOperationsListener() {
  const unsubsRef = useRef([])
  const {
    setActiveExecutions,
    updateGuardPosition,
    addAlert,
    updateStats,
    setConnected,
  } = useMonitoringStore()
  const { setIncidents, addIncident } = useIncidentStore()

  const subscribe = useCallback(() => {
    console.log(`${LOG_PREFIX} 🔴 Subscribing to operational streams...`)

    // ─── 1. Active Ronda Executions ───
    const execQuery = query(
      collection(db, COLLECTIONS.RONDA_EXECUTIONS),
      where('status', 'in', [RONDA_STATES.IN_PROGRESS, RONDA_STATES.PAUSED])
    )

    const unsubExec = onSnapshot(execQuery, (snapshot) => {
      const executions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      setActiveExecutions(executions)

      // Update guard positions from active executions
      executions.forEach((exec) => {
        if (exec.lastPosition && exec.guardId) {
          updateGuardPosition(exec.guardId, {
            lat: exec.lastPosition.lat,
            lng: exec.lastPosition.lng,
            accuracy: exec.lastPosition.accuracy,
            timestamp: exec.lastPosition.timestamp,
            status: exec.status,
            executionId: exec.id,
            rondaId: exec.rondaId,
          })
        }
      })

      console.log(`${LOG_PREFIX} Executions: ${executions.length} active`)
    }, (error) => {
      console.error(`${LOG_PREFIX} Execution listener error:`, error)
    })

    unsubsRef.current.push(unsubExec)

    // ─── 2. Open Incidents ───
    const incidentQuery = query(
      collection(db, COLLECTIONS.INCIDENTS),
      where('status', 'in', ['open', 'investigating', 'escalated'])
    )

    const unsubIncidents = onSnapshot(incidentQuery, (snapshot) => {
      const incidents = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      setIncidents(incidents)

      // Detect new incidents (added since last snapshot)
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const incident = { id: change.doc.id, ...change.doc.data() }
          if (incident.severity === 'critical' || incident.severity === 'high') {
            addAlert({
              type: 'incident',
              severity: incident.severity,
              title: `Incidente ${incident.severity.toUpperCase()}`,
              message: incident.title || 'Nuevo incidente reportado',
              data: incident,
            })
          }
        }
      })

      updateStats({ openIncidents: incidents.length })
      console.log(`${LOG_PREFIX} Incidents: ${incidents.length} open`)
    }, (error) => {
      console.error(`${LOG_PREFIX} Incident listener error:`, error)
    })

    unsubsRef.current.push(unsubIncidents)

    setConnected(true)
    console.log(`${LOG_PREFIX} ✅ All streams connected`)
  }, [setActiveExecutions, updateGuardPosition, addAlert, updateStats, setConnected, setIncidents, addIncident])

  const unsubscribeAll = useCallback(() => {
    unsubsRef.current.forEach((unsub) => unsub())
    unsubsRef.current = []
    setConnected(false)
    console.log(`${LOG_PREFIX} ⏹ All streams disconnected`)
  }, [setConnected])

  useEffect(() => {
    subscribe()
    return () => unsubscribeAll()
  }, [subscribe, unsubscribeAll])

  return { subscribe, unsubscribeAll }
}
