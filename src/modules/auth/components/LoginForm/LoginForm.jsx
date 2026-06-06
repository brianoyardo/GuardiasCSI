import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Typewriter from 'typewriter-effect'
import { loginWithEmail } from '@/modules/auth/services/authService'
import { t } from '@/config/labels'
import './LoginForm.css'
import '../../pages/LoginPage.css'

/**
 * LoginForm — SentinelOps Premium Auth Form
 * Branded with SVG shield-eye logo, icon-prefixed inputs,
 * password visibility toggle, and an animated submit button.
 */
export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await loginWithEmail(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || t('auth.errorGeneric'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {/* ─── Brand block ─── */}
      <div className="sentinel-login__brand">
        <ShieldEyeLogo />
        <h1 className="sentinel-login__brand-name">SentinelOps</h1>
        <div className="sentinel-login__tagline">
          <Typewriter
            options={{
              strings: [
                'Monitoreo de Seguridad en Tiempo Real',
                'Plataforma Operativa Geoespacial',
                'Control de Rondas y Checkpoints',
                'Sistema Táctico de Vigilancia',
              ],
              autoStart: true,
              loop: true,
              delay: 45,
              deleteSpeed: 25,
            }}
          />
        </div>
      </div>

      {/* ─── Card ─── */}
      <form className="sentinel-login__card" onSubmit={handleSubmit} noValidate>

        {/* Email field */}
        <div className="sentinel-field">
          <label className="sentinel-field__label" htmlFor="login-email">
            Correo Electrónico
          </label>
          <div className="sentinel-field__wrapper">
            <span className="sentinel-field__icon">
              <IconMail />
            </span>
            <input
              id="login-email"
              className="sentinel-field__input"
              type="email"
              placeholder="operador@sentinel.ops"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
        </div>

        {/* Password field */}
        <div className="sentinel-field">
          <label className="sentinel-field__label" htmlFor="login-password">
            Contraseña
          </label>
          <div className="sentinel-field__wrapper">
            <span className="sentinel-field__icon">
              <IconLock />
            </span>
            <input
              id="login-password"
              className="sentinel-field__input"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              minLength={6}
            />
            <button
              type="button"
              className="sentinel-field__eye-btn"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>
        </div>

        {/* Forgot password */}
        <div className="sentinel-login__forgot">
          <a href="#forgot">Olvidé mi contraseña</a>
        </div>

        {/* Error */}
        {error && (
          <div className="sentinel-login__error" role="alert" id="login-error">
            <IconAlert />
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          id="login-submit"
          className="sentinel-login__submit"
          type="submit"
          disabled={isLoading}
        >
          {isLoading && <span className="sentinel-login__spinner" aria-hidden="true" />}
          {isLoading ? 'Autenticando...' : 'Ingresar'}
        </button>

        {/* System status */}
        <div className="sentinel-login__status">
          <span className="sentinel-login__status-dot" />
          <span>Sistema operativo</span>
        </div>
      </form>
    </>
  )
}

/* ─── Inline SVG icons — zero dependency ─── */

function ShieldEyeLogo() {
  return (
    <svg
      className="sentinel-login__shield"
      viewBox="0 0 72 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="SentinelOps logo"
    >
      {/* Shield body */}
      <path
        d="M36 4L8 16V38C8 54.5 20.5 68.5 36 74C51.5 68.5 64 54.5 64 38V16L36 4Z"
        fill="rgba(15,30,60,0.7)"
        stroke="#3b82f6"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Shield inner glow edge */}
      <path
        d="M36 10L13 20V38C13 52 23.5 64.5 36 69.5C48.5 64.5 59 52 59 38V20L36 10Z"
        fill="none"
        stroke="rgba(59,130,246,0.3)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Eye white / iris */}
      <ellipse cx="36" cy="38" rx="13" ry="9" fill="none" stroke="#3b82f6" strokeWidth="1.8" />
      {/* Pupil */}
      <circle cx="36" cy="38" r="4.5" fill="#3b82f6" />
      {/* Pupil inner highlight */}
      <circle cx="37.5" cy="36.5" r="1.2" fill="rgba(255,255,255,0.6)" />
      {/* Glare lines */}
      <line x1="23" y1="38" x2="26" y2="38" stroke="#3b82f6" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      <line x1="46" y1="38" x2="49" y2="38" stroke="#3b82f6" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="2,4 12,13 22,4" />
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconEyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function IconAlert() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}
