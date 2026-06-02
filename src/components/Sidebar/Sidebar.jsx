import { memo } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/modules/auth/context/AuthContext'
import { getNavigationForRole, ROLE_LABELS } from '@/config/roles'
import { useLayoutStore } from '@/store/layoutStore'
import './Sidebar.css'

/**
 * Navigation icon mapping (emoji-based for now, can be swapped for icon library)
 */
const ICON_MAP = {
  grid: '▦',
  radar: '◎',
  route: '↻',
  users: '👥',
  map: '🗺',
  pin: '📍',
  alert: '⚠',
  chart: '📊',
  clock: '🕐',
  reports: '📄',
}

/**
 * Sidebar — main navigation component
 * Collapsible, role-based, responsive
 */
const Sidebar = memo(function Sidebar() {
  const { profile, role } = useAuth()
  const { isSidebarCollapsed, isMobileSidebarOpen, toggleSidebar, closeMobileSidebar } = useLayoutStore()

  const navItems = getNavigationForRole(role)
  const initials = (profile?.displayName || profile?.email || '?')
    .substring(0, 2)
    .toUpperCase()

  return (
    <>
      <aside
        className={`sidebar ${isSidebarCollapsed ? 'sidebar--collapsed' : ''} ${isMobileSidebarOpen ? 'sidebar--open' : ''}`}
        id="sidebar"
      >
        {/* Brand */}
        <div className="sidebar__brand">
          <div className="sidebar__brand-icon">SO</div>
          <span className="sidebar__brand-text">SentinelOps</span>
        </div>

        {/* Navigation */}
        <nav className="sidebar__nav">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
              }
              onClick={closeMobileSidebar}
            >
              <span className="sidebar__nav-icon">
                {ICON_MAP[item.icon] || '•'}
              </span>
              <span className="sidebar__nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__user-avatar">{initials}</div>
            <div className="sidebar__user-info">
              <div className="sidebar__user-name">
                {profile?.displayName || profile?.email}
              </div>
              <div className="sidebar__user-role">
                {ROLE_LABELS[role] || role}
              </div>
            </div>
          </div>
          <button
            className="sidebar__toggle"
            onClick={toggleSidebar}
            aria-label={isSidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {isSidebarCollapsed ? '▸▸' : '◂◂'}
          </button>
        </div>
      </aside>
    </>
  )
})

export default Sidebar
