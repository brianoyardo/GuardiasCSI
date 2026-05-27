import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Typewriter from 'typewriter-effect'
import { loginWithEmail } from '@/modules/auth/services/authService'
import { t } from '@/config/labels'
import './LoginForm.css'

/**
 * LoginForm — SentinelOps branded login form
 * Features typewriter effect for operational branding
 */
export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await loginWithEmail(email, password)
      // Navigation handled by auth state change → AuthContext → role routing
      navigate('/', { replace: true })
    } catch (err) {
      //console.error('Login error:', err.code, err.message)
      // authService throws enhanced errors with user-friendly messages
      setError(err.message || t('auth.errorGeneric'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-form" id="login-form">
      <div className="login-form__header">
        <h1 className="login-form__logo">SentinelOps</h1>
        <div className="login-form__typewriter">
          <Typewriter
            options={{
              strings: [
                'Plataforma Operativa Geoespacial',
                'Monitoreo de Seguridad en Tiempo Real',
                'Control de Rondas y Checkpoints',
                'Sistema Táctico de Vigilancia',
              ],
              autoStart: true,
              loop: true,
              delay: 50,
              deleteSpeed: 30,
            }}
          />
        </div>
      </div>

      <form className="login-form__card" onSubmit={handleSubmit}>
        <div className="login-form__field">
          <label className="login-form__label" htmlFor="login-email">
            {t('auth.emailPlaceholder')}
          </label>
          <input
            id="login-email"
            className="login-form__input"
            type="email"
            placeholder="operador@sentinel.ops"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="login-form__field">
          <label className="login-form__label" htmlFor="login-password">
            {t('auth.passwordPlaceholder')}
          </label>
          <input
            id="login-password"
            className="login-form__input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="login-form__error" role="alert">
            {error}
          </div>
        )}

        <button
          id="login-submit"
          className="login-form__submit"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? t('auth.loggingIn') : t('auth.loginButton')}
        </button>

        <div className="login-form__status">
          <span className="login-form__status-dot" />
          <span>Sistema operativo</span>
        </div>
      </form>
    </div>
  )
}
