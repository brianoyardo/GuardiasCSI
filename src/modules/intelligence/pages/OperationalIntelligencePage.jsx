import { useState, useEffect, useRef } from 'react'
import PlaybackMap from '../components/PlaybackMap'
import { calculateRouteAdherence } from '../services/patrolCompliance'
import { calculateOperationalScore } from '../services/operationalScoring'
import './OperationalIntelligencePage.css'

/**
 * OperationalIntelligencePage
 * Hub for Spatial Analytics, Scoring, and Patrol Playback
 */
export default function OperationalIntelligencePage() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  
  // Mock Data for Demo (In production, this would be fetched from Firestore using RondaExecution ID)
  const mockRouteGeometry = {
    type: 'LineString',
    coordinates: [
      [-63.1815, -17.7833],
      [-63.1820, -17.7840],
      [-63.1830, -17.7845]
    ]
  }

  const mockGpsTrack = [
    { lng: -63.1815, lat: -17.7833, timestamp: Date.now() },
    { lng: -63.1818, lat: -17.7838, timestamp: Date.now() + 1000 },
    { lng: -63.1825, lat: -17.7842, timestamp: Date.now() + 2000 },
    // A deviation
    { lng: -63.1840, lat: -17.7860, timestamp: Date.now() + 3000 },
    { lng: -63.1830, lat: -17.7845, timestamp: Date.now() + 4000 }
  ]

  const mockExecution = {
    status: 'completed',
    checkpointIds: ['cp1', 'cp2'],
    completedCheckpoints: ['cp1'],
    events: [{ type: 'GPS_ANOMALY' }]
  }

  // Analytics State
  const [adherence, setAdherence] = useState(null)
  const [score, setScore] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    // Calculate Analytics
    const compliance = calculateRouteAdherence(mockGpsTrack, mockRouteGeometry)
    setAdherence(compliance)

    const finalScore = calculateOperationalScore(mockExecution, compliance)
    setScore(finalScore)
  }, [])

  // Playback Interval Logic
  useEffect(() => {
    if (isPlaying && mockGpsTrack.length > 0) {
      const msPerFrame = 100 // Hardcoded speed for demo
      
      timerRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= mockGpsTrack.length - 1) {
            setIsPlaying(false) // Auto-pause at the end
            return mockGpsTrack.length - 1
          }
          return prev + 1
        })
      }, msPerFrame)
    } else {
      clearInterval(timerRef.current)
    }

    return () => clearInterval(timerRef.current)
  }, [isPlaying, mockGpsTrack.length])

  const togglePlayback = () => setIsPlaying(!isPlaying)

  const handleSliderChange = (e) => {
    setCurrentIndex(Number(e.target.value))
    setIsPlaying(false) // Pause if user manually drags slider
  }

  const getScoreColor = (value) => {
    if (value >= 80) return 'score-display__circle--high'
    if (value >= 50) return 'score-display__circle--medium'
    return 'score-display__circle--low'
  }

  const progressPercent = mockGpsTrack.length > 1 
    ? Math.round((currentIndex / (mockGpsTrack.length - 1)) * 100) 
    : 0

  return (
    <div className="intelligence-hub">
      <div className="intelligence-hub__header">
        <div>
          <h1 className="intelligence-hub__title">Inteligencia Operacional</h1>
          <p className="intelligence-hub__subtitle">Auditoría Espacial y Scoring Automático</p>
        </div>
      </div>

      <div className="intelligence-hub__grid">
        {/* ─── Analytics Sidebar ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div className="intelligence-card">
            <div className="intelligence-card__title">Scoring Operacional</div>
            {score && (
              <div className="score-display">
                <div className={`score-display__circle ${getScoreColor(score.score)}`}>
                  {score.score}
                </div>
                <div className="score-display__details">
                  <div>📍 Adherencia Ruta: {score.breakdown.adherence}/40</div>
                  <div>✅ Checkpoints: {score.breakdown.checkpoints}/40</div>
                  <div>⏱ Puntualidad: {score.breakdown.punctuality}/20</div>
                  <div style={{ color: 'var(--color-danger-400)' }}>⚠ Penalizaciones: -{score.breakdown.penalties}</div>
                </div>
              </div>
            )}
            <p style={{ fontSize: '12px', color: 'var(--color-dark-text-muted)' }}>
              El scoring se calcula matemáticamente usando Turf.js para analizar la desviación en metros del guardia respecto a la ruta oficial GeoJSON.
            </p>
          </div>

          <div className="intelligence-card">
            <div className="intelligence-card__title">Anomalías Espaciales detectadas</div>
            {adherence && (
              <div style={{ fontSize: '14px', color: 'var(--color-dark-text)' }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>{adherence.deviationsCount}</strong> Desviaciones de ruta (&gt;{25}m)
                </div>
                <div style={{ marginBottom: '8px' }}>
                  Desviación Máxima: <strong>{adherence.maxDeviationMeters} metros</strong>
                </div>
                <div style={{ color: 'var(--color-primary-400)', fontWeight: 'bold' }}>
                  Adherencia Total: {adherence.adherencePercentage}%
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ─── Playback Map ─── */}
        <div className="intelligence-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-dark-border)' }}>
            <div className="intelligence-card__title" style={{ margin: 0 }}>Playback de Ronda (Auditoría Visual)</div>
          </div>
          
          <div style={{ flex: 1, position: 'relative' }}>
            <PlaybackMap 
              track={mockGpsTrack} 
              routeGeometry={mockRouteGeometry}
              currentIndex={currentIndex}
            />
          </div>

          <div className="playback-controls" style={{ margin: '1rem' }}>
            <button className="playback-btn" onClick={togglePlayback}>
              {isPlaying ? '⏸' : '▶'}
            </button>
            <input 
              type="range" 
              className="playback-slider" 
              min="0" 
              max={mockGpsTrack.length > 0 ? mockGpsTrack.length - 1 : 0} 
              value={currentIndex}
              onChange={handleSliderChange}
            />
            <span style={{ fontSize: '12px', color: 'var(--color-dark-text-muted)', minWidth: '35px', textAlign: 'right' }}>
              {progressPercent}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
