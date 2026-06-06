import { useEffect, useRef } from 'react'
import LoginForm from '@/modules/auth/components/LoginForm/LoginForm'
import './LoginPage.css'

/**
 * SentinelOps LoginPage
 * Features an animated neural-network canvas background
 * drawn procedurally with requestAnimationFrame — no libraries needed.
 */
export default function LoginPage() {
  const canvasRef = useRef(null)

  /* ─── Neural-Network Canvas Animation ─── */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let animId
    let W, H
    const NODES = 80
    const MAX_DIST = 160
    const nodes = []

    const resize = () => {
      W = canvas.width = window.innerWidth
      H = canvas.height = window.innerHeight
    }

    const randomNode = () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.5 + 0.5,
    })

    const init = () => {
      resize()
      nodes.length = 0
      for (let i = 0; i < NODES; i++) nodes.push(randomNode())
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H)

      // Move nodes
      for (const n of nodes) {
        n.x += n.vx
        n.y += n.vy
        if (n.x < 0 || n.x > W) n.vx *= -1
        if (n.y < 0 || n.y > H) n.vy *= -1
      }

      // Draw edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.18
            ctx.beginPath()
            ctx.strokeStyle = `rgba(59,130,246,${alpha})`
            ctx.lineWidth = 0.6
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(96,165,250,0.45)'
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }

    init()
    draw()
    window.addEventListener('resize', init)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', init)
    }
  }, [])

  return (
    <div className="sentinel-login" id="login-page">
      {/* Neural-network animated background */}
      <canvas ref={canvasRef} className="sentinel-login__canvas" aria-hidden="true" />
      <div className="sentinel-login__vignette" aria-hidden="true" />

      {/* Main content */}
      <div className="sentinel-login__body">
        <LoginForm />
      </div>

      {/* Footer */}
      <LoginFooter />

      {/* Decorative spark */}
      <svg className="sentinel-login__spark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2L13.5 9.5L21 12L13.5 14.5L12 22L10.5 14.5L3 12L10.5 9.5L12 2Z"
          fill="rgba(96,165,250,0.8)"
        />
      </svg>
    </div>
  )
}

function LoginFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="sentinel-login__footer">
      <span className="sentinel-login__footer-copy">
        © {year} SentinelOps. All Rights Reserved.
      </span>
      <span className="sentinel-login__footer-sep">|</span>
      <a href="#terms">Términos de Servicio</a>
      <span className="sentinel-login__footer-sep">|</span>
      <a href="#privacy">Política de Privacidad</a>
    </footer>
  )
}
