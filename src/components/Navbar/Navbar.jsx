import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth/context/AuthContext'
import { logout } from '@/modules/auth/services/authService'
import { t } from '@/config/labels'
import './Navbar.css'

/**
 * Navbar — top bar with status and actions
 * @param {Object} props
 * @param {string} props.title - Page title
 * @param {Function} props.onMenuClick - Mobile menu toggle
 */
const Navbar = memo(function Navbar({ title, onMenuClick }) {
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
    <header className="navbar" id="navbar">
      <div className="navbar__left">
        <button
          className="navbar__menu-btn"
          onClick={onMenuClick}
          aria-label="Abrir menú"
        >
          ☰
        </button>
        <h2 className="navbar__title">{title || t('app.welcome')}</h2>
      </div>

      <div className="navbar__right">
        <div className="navbar__status">
          <span className="navbar__status-dot" />
          <span>{t('status.online')}</span>
        </div>

        <button
          className="navbar__logout"
          onClick={handleLogout}
          id="logout-btn"
        >
          {t('auth.logoutButton')}
        </button>
      </div>
    </header>
  )
})

export default Navbar
