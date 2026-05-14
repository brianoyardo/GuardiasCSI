import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth/context/AuthContext'
import { logout } from '@/modules/auth/services/authService'
import { t } from '@/config/labels'
import './GuardLayout.css'

/**
 * GuardLayout — Mobile-first layout for field guards
 * Features: top header + content + bottom tab navigation
 * NO sidebar, NO admin panels
 */
export default function GuardLayout() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (err) {
      console.error('Logout error:', err)
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
    </div>
  )
}
