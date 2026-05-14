import { useState, useEffect } from 'react'
import { useAttendance } from '@/modules/attendance/hooks/useAttendance'
import './AttendancePage.css'

export default function AttendancePage() {
  const { markCheckIn, markCheckOut, isSubmitting, error, accuracy } = useAttendance()
  const [time, setTime] = useState(new Date())
  const [status, setStatus] = useState(null) // 'in' or 'out'

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleIn = async () => {
    const res = await markCheckIn()
    if (res.success) setStatus('in')
  }

  const handleOut = async () => {
    const res = await markCheckOut()
    if (res.success) setStatus('out')
  }

  return (
    <div className="attendance">
      <div className="attendance__header">
        <h1 className="attendance__title">Control de Asistencia</h1>
        <div className="attendance__time">
          {time.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div className="attendance__date">
          {time.toLocaleDateString('es-BO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="attendance__actions">
        {status === 'in' ? (
          <div style={{ textAlign: 'center', color: 'var(--color-accent-400)', padding: '1rem', background: 'var(--color-dark-surface)', borderRadius: '1rem' }}>
            ✅ Ingreso registrado exitosamente
          </div>
        ) : (
          <button 
            className="attendance__btn attendance__btn--in"
            onClick={handleIn}
            disabled={isSubmitting || status === 'out'}
          >
            ▶ REGISTRAR INGRESO (GPS)
          </button>
        )}

        {status === 'out' ? (
          <div style={{ textAlign: 'center', color: 'var(--color-dark-text)', padding: '1rem', background: 'var(--color-dark-surface)', borderRadius: '1rem' }}>
            👋 Salida registrada. ¡Buen trabajo!
          </div>
        ) : (
          <button 
            className="attendance__btn attendance__btn--out"
            onClick={handleOut}
            disabled={isSubmitting || status !== 'in'}
          >
            ⏹ REGISTRAR SALIDA
          </button>
        )}
      </div>

      {error && <div className="attendance__error">{error}</div>}
      <div className="attendance__gps">
        {accuracy ? `Precisión GPS: ±${accuracy.toFixed(0)}m` : 'Buscando señal GPS...'}
      </div>
    </div>
  )
}
