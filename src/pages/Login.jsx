import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../services/firebase'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigate('/dashboard')
    } catch (err) {
      setError('No se pudo iniciar sesión')
      console.error(err)
    }
  }

  return (
    <div style={styles.container}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <h1 style={styles.title}>Ingreso de Guardia</h1>
        <p style={styles.subtitle}>Sistema de ronda y control</p>

        <input
          style={styles.input}
          type="email"
          placeholder="correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          style={styles.input}
          type="password"
          placeholder="contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.button} type="submit">
          Iniciar sesión
        </button>
      </form>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: '#f4f7fb',
  },
  card: {
    width: '360px',
    background: '#fff',
    padding: '32px',
    borderRadius: '16px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  title: {
    margin: 0,
    fontSize: '28px',
  },
  subtitle: {
    marginTop: 0,
    color: '#667085',
  },
  input: {
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid #d0d5dd',
    fontSize: '14px',
  },
  button: {
    padding: '12px 14px',
    borderRadius: '10px',
    border: 'none',
    background: '#111827',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
  },
  error: {
    color: '#b42318',
    fontSize: '14px',
  },
}