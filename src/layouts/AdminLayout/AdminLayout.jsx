import { Outlet } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import Sidebar from '@/components/Sidebar/Sidebar'
import Navbar from '@/components/Navbar/Navbar'
import { useLayoutStore } from '@/store/layoutStore'
import './AdminLayout.css'

/**
 * AdminLayout — used by Admin, Operations Chief, and Supervisor
 * Features CSS Grid layout, Zustand state, and Leaflet resize triggers
 */
export default function AdminLayout() {
  const { isSidebarCollapsed, toggleMobileSidebar } = useLayoutStore()
  const layoutRef = useRef(null)

  // Dispara el evento 'resize' cuando la transición del grid termina
  // Esto soluciona los problemas de renderizado de Leaflet.js
  useEffect(() => {
    const layoutElement = layoutRef.current
    if (!layoutElement) return

    const handleTransitionEnd = (e) => {
      if (e.propertyName === 'grid-template-columns') {
        window.dispatchEvent(new Event('resize'))
      }
    }

    layoutElement.addEventListener('transitionend', handleTransitionEnd)
    return () => {
      layoutElement.removeEventListener('transitionend', handleTransitionEnd)
    }
  }, [])

  return (
    <div 
      ref={layoutRef}
      className={`admin-layout ${isSidebarCollapsed ? 'admin-layout--collapsed' : ''}`} 
      id="admin-layout"
    >
      <Sidebar />

      <div className="admin-layout__main">
        <Navbar onMenuClick={toggleMobileSidebar} />

        <main className="admin-layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
