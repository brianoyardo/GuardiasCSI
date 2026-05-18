import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth/context/AuthContext'
import { logout } from '@/modules/auth/services/authService'
import { createPanicIncident } from '@/modules/incidents/services/incidentService'
import { t } from '@/config/labels'
import './GuardLayout.css'

export default function GuardLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  const triggerPanic = async () => {
    if (!confirm('🚨 ¿Confirmar alerta de pánico? Se enviará tu ubicación exacta.')) return

    if (!navigator.geolocation) {
      alert('GPS no disponible en este dispositivo.')
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

      alert('🚨 Alerta enviada. Mantén la calma. Ayuda en camino.')
    } catch (err) {
      console.error('Panic button error:', err)
      alert('Error enviando alerta. Verifica tu conexión o GPS.')
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

      {/* Bottom Navigation */}
      <nav className="guard-layout__bottom-nav" id="guard-bottom-nav">
        <NavLink
          to="/guard/mis-rondas"
          className={({ isActive }) =>
            `guard-layout__nav-item ${isActive ? 'guard-layout__nav-item--active' : ''}`
          }
        >
          <span className="guard-layout__nav-icon">↻</span>
          <span className="guard-layout__nav-label">{t('nav.misRondas')}</span>
        </NavLink>

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

      {/* Panic FAB */}
      <button className="guard-layout__panic-fab" onClick={triggerPanic} aria-label="Botón de pánico">
        🚨 PÁNICO
      </button>
    </div>
  )
}
