import { useState, useEffect, useRef } from 'react'
import PlaybackMap from '../components/PlaybackMap'
import { calculateRouteAdherence } from '../services/patrolCompliance'
import { calculateOperationalScore } from '../services/operationalScoring'
import { getHistoricalExecutions, getExecutionTelemetry } from '@/modules/rondas/services/rondaExecutionService'
import { getRoute } from '@/modules/spatial/services/spatialService'
import './OperationalIntelligencePage.css'

/**
 * OperationalIntelligencePage
 * Hub for Spatial Analytics, Scoring, and Patrol Playback
 */
export default function OperationalIntelligencePage() {
  const [executions, setExecutions] = useState([])
  const [selectedExecutionId, setSelectedExecutionId] = useState('')
  
  // Real Data State
  const [activeExecution, setActiveExecution] = useState(null)
  const [gpsTrack, setGpsTrack] = useState([])
  const [routeGeometry, setRouteGeometry] = useState(null)
  const [loadingMapData, setLoadingMapData] = useState(false)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  
  // Analytics State
  const [adherence, setAdherence] = useState(null)
  const [score, setScore] = useState(null)
  const timerRef = useRef(null)

  // 1. Fetch available historical executions on mount
  useEffect(() => {
    async function loadExecutions() {
      const execs = await getHistoricalExecutions()
      setExecutions(execs)
    }
    loadExecutions()
  }, [])

  // 2. Fetch telemetry when an execution is selected
  useEffect(() => {
    if (!selectedExecutionId) return

    async function fetchPlaybackData() {
      setLoadingMapData(true)
      setIsPlaying(false)
      setCurrentIndex(0)
      setAdherence(null)
      setScore(null)
      
      const exec = executions.find(e => e.id === selectedExecutionId)
      setActiveExecution(exec)

      const [track, route] = await Promise.all([
        getExecutionTelemetry(selectedExecutionId),
        exec.routeId ? getRoute(exec.routeId) : null
      ])

      setGpsTrack(track)
      setRouteGeometry(route?.geometry || null)
      
      if (route?.geometry && track.length > 0) {
        const compliance = calculateRouteAdherence(track, route.geometry)
        setAdherence(compliance)
        const finalScore = calculateOperationalScore(exec, compliance)
        setScore(finalScore)
      }

      setLoadingMapData(false)
    }

    fetchPlaybackData()
  }, [selectedExecutionId, executions])

  // Playback Interval Logic
  useEffect(() => {
    if (isPlaying && gpsTrack.length > 0) {
      const msPerFrame = 100 // 10fps for playback
      
      timerRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= gpsTrack.length - 1) {
            setIsPlaying(false) // Auto-pause at the end
            return gpsTrack.length - 1
          }
          return prev + 1
        })
      }, msPerFrame)
    } else {
      clearInterval(timerRef.current)
    }

    return () => clearInterval(timerRef.current)
  }, [isPlaying, gpsTrack.length])

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

  const progressPercent = gpsTrack.length > 1 
    ? Math.round((currentIndex / (gpsTrack.length - 1)) * 100) 
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
            <div className="intelligence-card__title">Seleccionar Ejecución (Auditoría)</div>
            <select 
              value={selectedExecutionId} 
              onChange={e => setSelectedExecutionId(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', background: 'var(--color-dark-bg)', color: 'white', border: '1px solid var(--color-dark-border)', borderRadius: '4px' }}
            >
              <option value="">-- Seleccione una ronda completada --</option>
              {executions.map(e => (
                <option key={e.id} value={e.id}>
                  {e.id} | Guardia: {e.guardId} | Puntos: {e.gpsTrack?.length || '?'}
                </option>
              ))}
            </select>
          </div>

          {score && (
            <div className="intelligence-card">
              <div className="intelligence-card__title">Scoring Operacional</div>
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
            </div>
          )}

          {adherence && (
            <div className="intelligence-card">
              <div className="intelligence-card__title">Anomalías Espaciales</div>
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
            </div>
          )}

        </div>

        {/* ─── Playback Map ─── */}
        <div className="intelligence-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-dark-border)' }}>
            <div className="intelligence-card__title" style={{ margin: 0 }}>
              Playback de Ronda {loadingMapData ? '(Cargando Chunks...)' : ''}
            </div>
          </div>
          
          <div style={{ flex: 1, position: 'relative' }}>
            <PlaybackMap 
              track={gpsTrack} 
              routeGeometry={routeGeometry}
              currentIndex={currentIndex}
            />
          </div>

          <div className="playback-controls" style={{ margin: '1rem' }}>
            <button 
              className="playback-btn" 
              onClick={togglePlayback}
              disabled={gpsTrack.length === 0}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <input 
              type="range" 
              className="playback-slider" 
              min="0" 
              max={gpsTrack.length > 0 ? gpsTrack.length - 1 : 0} 
              value={currentIndex}
              onChange={handleSliderChange}
              disabled={gpsTrack.length === 0}
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
