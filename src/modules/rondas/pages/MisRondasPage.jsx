import { useState, useEffect } from 'react'
import { useAuth } from '@/modules/auth/context/AuthContext'
import { subscribeToGuardAssignments } from '@/modules/rondas/services/rondaAssignmentService'
import { RONDA_STATES, isActiveState, isTerminalState } from '@/modules/rondas/stateMachine/rondaStateMachine'
import RondaCard from '@/modules/rondas/components/RondaCard/RondaCard'
import './MisRondasPage.css'

/**
 * MisRondasPage — Guard's patrol dashboard
 * Mobile-first, shows assigned rondas grouped by status
 * Direct access: no complex navigation, no admin panels
 */
export default function MisRondasPage() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return

    setLoading(true)
    const unsubscribe = subscribeToGuardAssignments(user.uid, (data) => {
      setAssignments(data)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user?.uid])

  // Group assignments by category
  const active = assignments.filter((a) => isActiveState(a.status))
  const available = assignments.filter((a) => a.status === RONDA_STATES.AVAILABLE)
  const pending = assignments.filter((a) => a.status === RONDA_STATES.PENDING)
  const completed = assignments.filter((a) => isTerminalState(a.status))

  // Simultaneous ronda guard: block new starts if one is already active
  const hasActiveRonda = active.length > 0

  const today = new Date().toLocaleDateString('es-BO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  if (loading) {
    return (
      <div className="mis-rondas__loading">
        <span>Cargando rondas...</span>
      </div>
    )
  }

  return (
    <div className="mis-rondas" id="mis-rondas-page">
      <div className="mis-rondas__header">
        <h1 className="mis-rondas__title">Mis Rondas</h1>
        <span className="mis-rondas__date">{today}</span>
      </div>

      {/* Active rondas (top priority) */}
      {active.length > 0 && (
        <div className="mis-rondas__section">
          <div className="mis-rondas__section-title">🔴 En Progreso</div>
          {active.map((a) => (
            <RondaCard key={a.id} assignment={a} />
          ))}
        </div>
      )}

      {/* Available to start */}
      {available.length > 0 && (
        <div className="mis-rondas__section">
          <div className="mis-rondas__section-title">▶ Disponibles</div>
          {available.map((a) => (
            <RondaCard key={a.id} assignment={a} hasActiveRonda={hasActiveRonda} />
          ))}
        </div>
      )}

      {/* Pending (not yet available) */}
      {pending.length > 0 && (
        <div className="mis-rondas__section">
          <div className="mis-rondas__section-title">⏳ Programadas</div>
          {pending.map((a) => (
            <RondaCard key={a.id} assignment={a} />
          ))}
        </div>
      )}

      {/* Completed today */}
      {completed.length > 0 && (
        <div className="mis-rondas__section">
          <div className="mis-rondas__section-title">✓ Completadas</div>
          {completed.map((a) => (
            <RondaCard key={a.id} assignment={a} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {assignments.length === 0 && (
        <div className="mis-rondas__empty">
          <div className="mis-rondas__empty-icon">📋</div>
          <p>No tienes rondas asignadas hoy</p>
        </div>
      )}
    </div>
  )
}
