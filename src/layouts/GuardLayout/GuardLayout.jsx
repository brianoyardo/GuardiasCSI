import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth/context/AuthContext'
import { logout } from '@/modules/auth/services/authService'
import { createPanicIncident } from '@/modules/incidents/services/incidentService'
import { t } from '@/config/labels'
import styled from 'styled-components'
import { FaExclamationTriangle } from 'react-icons/fa'
import PanicModal from '@/components/ui/PanicModal/PanicModal'
import './GuardLayout.css'

const PanicButtonContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
`

const PanicButtonCircle = styled.button`
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  border: 3px solid #ef4444;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow:
    0 4px 16px rgba(220, 38, 38, 0.5),
    0 0 24px rgba(239, 68, 68, 0.3),
    0 -2px 8px rgba(0, 0, 0, 0.2);
  transform: translateY(-12px);
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-14px) scale(1.05);
    box-shadow:
      0 6px 24px rgba(220, 38, 38, 0.7),
      0 0 32px rgba(239, 68, 68, 0.5),
      0 -2px 8px rgba(0, 0, 0, 0.3);
  }

  &:active {
    transform: translateY(-10px) scale(0.95);
  }
`

const PanicIcon = styled(FaExclamationTriangle)`
  font-size: 1.5rem;
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.3));
`

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

        <PanicButtonContainer>
          <PanicButtonCircle onClick={() => setShowPanicModal(true)} aria-label="Botón de pánico">
            <PanicIcon />
          </PanicButtonCircle>
        </PanicButtonContainer>

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
