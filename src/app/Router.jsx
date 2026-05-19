import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth/context/AuthContext'
import { ROLES, ROLE_DEFAULT_ROUTES } from '@/config/roles'
import ProtectedRoute from '@/components/ProtectedRoute/ProtectedRoute'
import LoadingScreen from '@/components/LoadingScreen/LoadingScreen'

/* Layouts */
import AdminLayout from '@/layouts/AdminLayout/AdminLayout'
import GuardLayout from '@/layouts/GuardLayout/GuardLayout'

/* Auth Pages */
import LoginPage from '@/modules/auth/pages/LoginPage'

/* Ronda Pages */
import MisRondasPage from '@/modules/rondas/pages/MisRondasPage'
import RondaExecutionPage from '@/modules/rondas/pages/RondaExecutionPage'
import RondasAdminPage from '@/modules/rondas/pages/RondasAdminPage'

/* Monitoring Pages */
import AdminDashboardPage from '@/modules/monitoring/pages/AdminDashboardPage'
import LiveMonitoringPage from '@/modules/monitoring/pages/LiveMonitoringPage'

/* Operational Pages */
import { IncidentManagementPage, IncidentReportPage } from '@/modules/incidents'
import { AttendancePage } from '@/modules/attendance'
import { UsersPage } from '@/modules/users'
import { SpatialManagementPage } from '@/modules/spatial'
import { OperationalIntelligencePage } from '@/modules/intelligence'
import SimulatorPage from '@/modules/guard-simulator/pages/SimulatorPage'

/* Placeholder pages (to be replaced with real modules) */
function PlaceholderPage({ title }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '60vh',
      flexDirection: 'column',
      gap: '1rem',
    }}>
      <h1 style={{ color: 'var(--color-primary-400)', fontSize: '2rem' }}>{title}</h1>
      <p style={{ color: 'var(--color-dark-text-muted)' }}>Módulo en desarrollo</p>
    </div>
  )
}

/**
 * RoleRedirect — redirects authenticated users to their role-specific home
 */
function RoleRedirect() {
  const { role, loading } = useAuth()

  if (loading) return <LoadingScreen />

  const defaultRoute = ROLE_DEFAULT_ROUTES[role] || '/login'
  return <Navigate to={defaultRoute} replace />
}

/**
 * Router — role-based routing for SentinelOps
 */
export default function AppRouter() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Root redirect based on role */}
      <Route path="/" element={
        <ProtectedRoute>
          <RoleRedirect />
        </ProtectedRoute>
      } />

      {/* ─── Admin Routes ─── */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="monitoring" element={<LiveMonitoringPage />} />
        <Route path="rondas" element={<RondasAdminPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="spatial" element={<SpatialManagementPage />} />
        {/* Redirect old paths to spatial editor */}
        <Route path="routes" element={<Navigate to="../spatial" replace />} />
        <Route path="checkpoints" element={<Navigate to="../spatial" replace />} />
        <Route path="geofences" element={<Navigate to="../spatial" replace />} />
        <Route path="incidents" element={<IncidentManagementPage />} />
        <Route path="analytics" element={<OperationalIntelligencePage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="simulator" element={<SimulatorPage />} />
      </Route>

      {/* ─── Operations Chief Routes ─── */}
      <Route path="/ops" element={
        <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.OPERATIONS_CHIEF]}>
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="monitoring" replace />} />
        <Route path="monitoring" element={<LiveMonitoringPage />} />
        <Route path="rondas" element={<RondasAdminPage />} />
        <Route path="guards" element={<PlaceholderPage title="Guardias" />} />
        <Route path="incidents" element={<IncidentManagementPage />} />
        <Route path="analytics" element={<OperationalIntelligencePage />} />
        <Route path="simulator" element={<SimulatorPage />} />
      </Route>

      {/* ─── Supervisor Routes ─── */}
      <Route path="/supervisor" element={
        <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.OPERATIONS_CHIEF, ROLES.SUPERVISOR]}>
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="monitoring" replace />} />
        <Route path="monitoring" element={<LiveMonitoringPage />} />
        <Route path="rondas" element={<RondasAdminPage />} />
        <Route path="incidents" element={<IncidentManagementPage />} />
      </Route>

      {/* ─── Guard Routes (mobile-first) ─── */}
      <Route path="/guard" element={
        <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.GUARD]}>
          <GuardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="mis-rondas" replace />} />
        <Route path="mis-rondas" element={<MisRondasPage />} />
        <Route path="ronda/:executionId" element={<RondaExecutionPage />} />
        <Route path="incidents" element={<IncidentReportPage />} />
      </Route>

      {/* Unauthorized */}
      <Route path="/unauthorized" element={
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: '1rem',
          background: 'var(--color-dark-bg)',
        }}>
          <h1 style={{ color: 'var(--color-danger-400)', fontSize: '2rem' }}>Acceso Denegado</h1>
          <p style={{ color: 'var(--color-dark-text-muted)' }}>No tienes permiso para acceder a esta sección</p>
        </div>
      } />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
