import LoginForm from '@/modules/auth/components/LoginForm/LoginForm'
import './LoginPage.css'

/**
 * LoginPage — Full-screen auth page with background grid
 */
export default function LoginPage() {
  return (
    <div className="login-page" id="login-page">
      <div className="login-page__grid-bg" />
      <div className="login-page__content">
        <LoginForm />
      </div>
    </div>
  )
}
