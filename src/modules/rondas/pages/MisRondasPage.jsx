import { useState, useEffect } from 'react'
import { useAuth } from '@/modules/auth/context/AuthContext'
import { subscribeToGuardAssignments } from '@/modules/rondas/services/rondaAssignmentService'
import { RONDA_STATES, isActiveState, isTerminalState } from '@/modules/rondas/stateMachine/rondaStateMachine'
import { syncTrueTime, getTrueTime } from '@/utils/timeSync'
import RondaCard from '@/modules/rondas/components/RondaCard/RondaCard'
import VoiceEnrollmentModal from '@/modules/rondas/components/VoiceEnrollmentModal/VoiceEnrollmentModal'
import './MisRondasPage.css'

export default function MisRondasPage() {
  const { user, profile } = useAuth()
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false)

  const isVoiceEnrolled = profile?.voiceEnrolled === true

  useEffect(() => {
    syncTrueTime()
  }, [])

  useEffect(() => {
    if (!user?.uid) return

    setLoading(true)
    const unsubscribe = subscribeToGuardAssignments(user.uid, (data) => {
      setAssignments(data)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user?.uid])

  // 24h window filter using true time
  const now = getTrueTime()
  const oneDay = 24 * 60 * 60 * 1000
  const twelveHours = 12 * 60 * 60 * 1000
  const windowedAssignments = assignments.filter(a => {
    const start = a.scheduledStart
    if (!start) return false
    return start >= (now - oneDay) && start <= (now + twelveHours)
  })

  // Apply status filter
  const filtered = windowedAssignments.filter(a => {
    if (filter === 'ALL') return true
    if (filter === 'PENDING') return a.status === RONDA_STATES.PENDING || a.status === RONDA_STATES.AVAILABLE
    if (filter === 'COMPLETED') return isTerminalState(a.status)
    return true
  })

  // Group for display
  const active = filtered.filter((a) => isActiveState(a.status))
  const pending = filtered.filter((a) => a.status === RONDA_STATES.PENDING || a.status === RONDA_STATES.AVAILABLE)
  const completed = filtered.filter((a) => isTerminalState(a.status))

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

      {/* Voice Enrollment Banner */}
      {!loading && !isVoiceEnrolled && (
        <div 
          className="mis-rondas__enrollment-banner"
          onClick={() => setShowEnrollmentModal(true)}
        >
          <span className="mis-rondas__enrollment-icon">⚠️</span>
          <div className="mis-rondas__enrollment-text">
            <strong>Acción Requerida:</strong> Registre su perfil de voz para poder iniciar rondas.
          </div>
          <button className="mis-rondas__enrollment-btn">Registrar</button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="mis-rondas__filters">
        <button
          className={`mis-rondas__filter-btn ${filter === 'ALL' ? 'mis-rondas__filter-btn--active' : ''}`}
          onClick={() => setFilter('ALL')}
        >
          Todas
        </button>
        <button
          className={`mis-rondas__filter-btn ${filter === 'PENDING' ? 'mis-rondas__filter-btn--active' : ''}`}
          onClick={() => setFilter('PENDING')}
        >
          Pendientes
        </button>
        <button
          className={`mis-rondas__filter-btn ${filter === 'COMPLETED' ? 'mis-rondas__filter-btn--active' : ''}`}
          onClick={() => setFilter('COMPLETED')}
        >
          Completadas
        </button>
      </div>

      {/* Active rondas */}
      {active.length > 0 && (
        <div className="mis-rondas__section">
          <div className="mis-rondas__section-title">🔴 En Progreso</div>
          {active.map((a) => (
            <RondaCard key={a.id} assignment={a} isVoiceEnrolled={isVoiceEnrolled} />
          ))}
        </div>
      )}

      {/* Available/Pending */}
      {pending.length > 0 && (
        <div className="mis-rondas__section">
          <div className="mis-rondas__section-title">▶ Disponibles</div>
          {pending.map((a) => (
            <RondaCard key={a.id} assignment={a} hasActiveRonda={hasActiveRonda} isVoiceEnrolled={isVoiceEnrolled} />
          ))}
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="mis-rondas__section">
          <div className="mis-rondas__section-title">✓ Completadas</div>
          {completed.map((a) => (
            <RondaCard key={a.id} assignment={a} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="mis-rondas__empty">
          <div className="mis-rondas__empty-icon">📋</div>
          <p>No hay rondas en este filtro</p>
        </div>
      )}

      {/* Voice Enrollment Modal */}
      {showEnrollmentModal && (
        <VoiceEnrollmentModal 
          onClose={() => setShowEnrollmentModal(false)}
          onSuccess={() => setShowEnrollmentModal(false)}
        />
      )}
    </div>
  )
}
