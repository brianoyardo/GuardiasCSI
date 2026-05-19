import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/modules/auth/context/AuthContext'
import LoadingScreen from '@/components/LoadingScreen/LoadingScreen'

const LOG_PREFIX = '[ProtectedRoute]'

/**
 * ProtectedRoute — comprehensive route guard
 * Validates: authentication + Firestore profile + role + status + permissions
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string[]} [props.allowedRoles] - Roles allowed to access this route
 * @param {string} [props.requiredPermission] - Specific permission required
 */
export default function ProtectedRoute({ children, allowedRoles, requiredPermission }) {
  const {
    isAuthenticated,
    isProfileComplete,
    role,
    profile,
    loading,
    profileLoading,
    error,
    checkPermission,
  } = useAuth()
  const location = useLocation()

  // ─── Loading states ───
  if (loading || profileLoading) {
    // console.log(`${LOG_PREFIX} Loading auth/profile...`)
    return <LoadingScreen message="Verificando credenciales..." />
  }

  // ─── Not authenticated ───
  if (!isAuthenticated) {
    // console.log(`${LOG_PREFIX} ❌ Not authenticated, redirecting to /login`)
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // ─── Auth error (suspended, etc.) ───
  if (error) {
    // console.log(`${LOG_PREFIX} ❌ Auth error: ${error}`)
    return <Navigate to="/login" state={{ error }} replace />
  }

  // ─── Profile incomplete or missing ───
  if (!isProfileComplete) {
    // console.warn(`${LOG_PREFIX} ⚠ Profile incomplete for user:`, profile?.email)
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem',
        background: 'var(--color-dark-bg)',
        color: 'var(--color-dark-text)',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <h1 style={{ color: 'var(--color-warning-400)', fontSize: '1.5rem' }}>
          ⚠ Perfil Incompleto
        </h1>
        <p style={{ color: 'var(--color-dark-text-muted)', maxWidth: '400px' }}>
          Tu perfil de usuario no está configurado correctamente.
          Contacta al administrador del sistema.
        </p>
        <p style={{ color: 'var(--color-dark-text-muted)', fontSize: '0.875rem' }}>
          Email: {profile?.email || 'desconocido'}
          <br />
          Rol: {profile?.role || 'sin asignar'}
          <br />
          Estado: {profile?.status || 'desconocido'}
        </p>
      </div>
    )
  }

  // ─── Role check ───
  if (allowedRoles && !allowedRoles.includes(role)) {
    // console.warn(`${LOG_PREFIX} ❌ Role "${role}" not in allowed: [${allowedRoles.join(', ')}]`)
    return <Navigate to="/unauthorized" replace />
  }

  // ─── Permission check ───
  if (requiredPermission && !checkPermission(requiredPermission)) {
    // console.warn(`${LOG_PREFIX} ❌ Missing permission: "${requiredPermission}" for role "${role}"`)
    return <Navigate to="/unauthorized" replace />
  }

  // console.log(`${LOG_PREFIX} ✅ Access granted for role: ${role}`)
  return children
}
