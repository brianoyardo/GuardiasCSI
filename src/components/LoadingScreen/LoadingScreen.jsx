import './LoadingScreen.css'

/**
 * LoadingScreen — full-screen radar-style loading indicator
 * Used during auth checks and initial data loading
 */
export default function LoadingScreen({ message = 'Cargando sistema...' }) {
  return (
    <div className="loading-screen" id="loading-screen">
      <span className="loading-screen__brand">SentinelOps</span>

      <div className="loading-screen__radar">
        <div className="loading-screen__radar-ring" />
        <div className="loading-screen__radar-ring loading-screen__radar-ring--inner" />
        <div className="loading-screen__radar-sweep" />
        <div className="loading-screen__radar-dot" />
      </div>

      <span className="loading-screen__text">{message}</span>
    </div>
  )
}
