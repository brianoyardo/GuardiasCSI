import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth/context/AuthContext'
import { logout } from '@/modules/auth/services/authService'
import { createPanicIncident } from '@/modules/incidents/services/incidentService'
import PanicModal from '@/components/ui/PanicModal/PanicModal'
import './GuardLayout.css'

export default function GuardLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [showPanicModal, setShowPanicModal] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  const triggerPanic = async () => {
    setShowPanicModal(true)
  }

  const handlePanicConfirm = async () => {
    setIsSending(true)

    if (!navigator.geolocation) {
      alert('GPS no disponible en este dispositivo.')
      setIsSending(false)
      return
    }

    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        })
      })

      const { latitude, longitude } = pos.coords

      await createPanicIncident({
        guardId: user.uid,
        location: { lat: latitude, lng: longitude },
      })
    } catch (err) {
      console.error('Panic button error:', err)
      alert('Error enviando alerta. Verifica tu conexión o GPS.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="guard-layout" id="guard-layout">
      {/* Header */}
      <header className="guard-layout__header">
        <div className="guard-layout__brand">
          <div className="guard-layout__brand-icon">SO</div>
          <span className="guard-layout__brand-text">SentinelOps</span>
        </div>
        <button
          className="guard-layout__logout"
          onClick={handleLogout}
        >
          Salir
        </button>
      </header>

      {/* Content */}
      <main className="guard-layout__content">
        <Outlet />
      </main>

      {/* Bottom Navigation with Cutout */}
      <nav className="guard-layout__bottom-nav" id="guard-bottom-nav">
        {/* Elemento 1: Izquierda */}
        <NavLink
          to="/guard/mis-rondas"
          className={({ isActive }) =>
            `guard-layout__nav-item ${isActive ? 'guard-layout__nav-item--active' : ''}`
          }
        >
          <span className="guard-layout__nav-icon">↻</span>
          <span className="guard-layout__nav-label">Mis Rondas</span>
        </NavLink>

        {/* Elemento CENTRAL: Botón de Pánico Flotante (Fuera del flujo flex) */}
        <div className="panic-button-container" onClick={triggerPanic} id="panic-button">
          <button className="panic-button-circle" aria-label="Botón de pánico">
            🚨
          </button>
        </div>

        {/* Elemento 2: Derecha */}
        <NavLink
          to="/guard/incidents"
          className={({ isActive }) =>
            `guard-layout__nav-item ${isActive ? 'guard-layout__nav-item--active' : ''}`
          }
        >
          <span className="guard-layout__nav-icon">⚠</span>
          <span className="guard-layout__nav-label">Reportar</span>
        </NavLink>
      </nav>

      {/* Panic Modal */}
      {showPanicModal && (
        <PanicModal
          onConfirm={handlePanicConfirm}
          onCancel={() => setShowPanicModal(false)}
          isSending={isSending}
        />
      )}
    </div>
  )
}
