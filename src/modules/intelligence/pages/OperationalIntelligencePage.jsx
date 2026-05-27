import { useState, useEffect, useRef, useMemo } from 'react'
import PlaybackMap from '../components/PlaybackMap'
import { calculateRouteAdherence } from '../services/patrolCompliance'
import { calculateOperationalScore } from '../services/operationalScoring'
import { getHistoricalExecutions } from '@/modules/rondas/services/rondaExecutionService'
import { getRoute, getGeofences } from '@/modules/spatial/services/spatialService'
import { getAssignment } from '@/modules/rondas/services/rondaAssignmentService'
import ActivityDatePicker from '@/components/ui/ActivityDatePicker/ActivityDatePicker'
import CustomSelect from '@/components/ui/CustomSelect/CustomSelect'
import './OperationalIntelligencePage.css'

/**
 * OperationalIntelligencePage — Phase 20
 * Advanced Analytics: Date picker, search, speed controls, operational scoring
 */

const SPEED_OPTIONS = [
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 4, label: '4x' },
  { value: 8, label: '8x' },
]

export default function OperationalIntelligencePage() {
  const [executions, setExecutions] = useState([])
  const [geofences, setGeofences] = useState([])
  const [selectedExecutionId, setSelectedExecutionId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDate, setSelectedDate] = useState('')

  // Real Data State
  const [activeExecution, setActiveExecution] = useState(null)
  const [assignmentData, setAssignmentData] = useState(null)
  const [gpsTrack, setGpsTrack] = useState([])
  const [routeGeometry, setRouteGeometry] = useState(null)
  const [loadingMapData, setLoadingMapData] = useState(false)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  // Analytics State
  const [adherence, setAdherence] = useState(null)
  const [score, setScore] = useState(null)
  const timerRef = useRef(null)

  // 1. Fetch historical executions and geofences
  useEffect(() => {
    async function loadData() {
      const [execs, geos] = await Promise.all([
        getHistoricalExecutions(),
        getGeofences(),
      ])
      setExecutions(execs)
      setGeofences(geos)
    }
    loadData()
  }, [])

  // Phase 20.2: Active dates for calendar
  const activeDays = useMemo(() => {
    const days = new Set()
    executions.forEach(e => {
      const ts = e.startedAt?.toMillis ? e.startedAt.toMillis() : (typeof e.startedAt === 'number' ? e.startedAt : null)
      if (ts) {
        const d = new Date(ts)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        days.add(key)
      }
    })
    return days
  }, [executions])

  // Phase 20.1 + 20.3: Filtered and labeled execution list
  const filteredExecutions = useMemo(() => {
    let result = executions

    // Filter by date
    if (selectedDate) {
      result = result.filter(e => {
        const ts = e.startedAt?.toMillis ? e.startedAt.toMillis() : (typeof e.startedAt === 'number' ? e.startedAt : 0)
        const d = new Date(ts)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        return key === selectedDate
      })
    }

    // Search by guard name/code
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(e => {
        const name = (e.guardName || '').toLowerCase()
        const code = (e.guardCode || '').toLowerCase()
        const route = (e.routeName || '').toLowerCase()
        return name.includes(q) || code.includes(q) || route.includes(q)
      })
    }

    return result
  }, [executions, selectedDate, searchQuery])

  // Phase 20.3: Build execution options for CustomSelect
  const executionOptions = useMemo(() => {
    return [
      { value: '', label: '— Seleccionar ejecución —' },
      ...filteredExecutions.map(e => {
        const ts = e.startedAt?.toMillis ? e.startedAt.toMillis() : (typeof e.startedAt === 'number' ? e.startedAt : 0)
        const time = new Date(ts).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
        const geoName = e.geofenceName || ''
        return {
          value: e.id,
          label: `${e.guardCode || '???'} ${e.guardName || '—'} · ${geoName || e.routeName || '—'} · ${time}`,
        }
      })
    ]
  }, [filteredExecutions])

  // 2. Fetch telemetry + assignment when execution selected
  useEffect(() => {
    if (!selectedExecutionId) return

    async function fetchPlaybackData() {
      setLoadingMapData(true)
      setIsPlaying(false)
      setCurrentIndex(0)
      setAdherence(null)
      setScore(null)
      setAssignmentData(null)

      const exec = executions.find(e => e.id === selectedExecutionId)
      setActiveExecution(exec)

      // Phase 21: Read gpsTrack directly from the execution document
      const track = exec?.gpsTrack || []
      setGpsTrack(track)

      const [route, assignment] = await Promise.all([
        exec?.routeId ? getRoute(exec.routeId) : null,
        exec?.assignmentId ? getAssignment(exec.assignmentId) : null,
      ])

      setRouteGeometry(route?.geometry || null)
      setAssignmentData(assignment)

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

  // Playback Interval Logic — Phase 20.4: Speed controls
  useEffect(() => {
    if (isPlaying && gpsTrack.length > 0) {
      const msPerFrame = Math.round(100 / playbackSpeed)

      timerRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= gpsTrack.length - 1) {
            setIsPlaying(false)
            return gpsTrack.length - 1
          }
          return prev + 1
        })
      }, msPerFrame)
    } else {
      clearInterval(timerRef.current)
    }

    return () => clearInterval(timerRef.current)
  }, [isPlaying, gpsTrack.length, playbackSpeed])

  const handlePlay = () => setIsPlaying(true)
  const handlePause = () => setIsPlaying(false)
  const handleStop = () => { setIsPlaying(false); setCurrentIndex(0) }

  const handleSliderChange = (e) => {
    setCurrentIndex(Number(e.target.value))
    setIsPlaying(false)
  }

  // Phase 20.5: Compute new metrics
  const durationMinutes = useMemo(() => {
    if (!activeExecution) return null
    const start = activeExecution.startedAt?.toMillis ? activeExecution.startedAt.toMillis() : (typeof activeExecution.startedAt === 'number' ? activeExecution.startedAt : 0)
    const end = activeExecution.endedAt?.toMillis ? activeExecution.endedAt.toMillis() : (typeof activeExecution.endedAt === 'number' ? activeExecution.endedAt : 0)
    if (!start || !end) return null
    return Math.round((end - start) / 60000)
  }, [activeExecution])

  const startStatus = useMemo(() => {
    if (!activeExecution || !assignmentData) return null
    const execStart = activeExecution.startedAt?.toMillis ? activeExecution.startedAt.toMillis() : (typeof activeExecution.startedAt === 'number' ? activeExecution.startedAt : 0)
    // scheduledStart is int64 milliseconds as confirmed by user
    const scheduledStart = typeof assignmentData.scheduledStart === 'number' ? assignmentData.scheduledStart : 0
    if (!execStart || !scheduledStart) return null
    const delayMs = execStart - scheduledStart
    return delayMs <= 5 * 60 * 1000 ? 'on_time' : 'late'
  }, [activeExecution, assignmentData])

  const checkpointPercent = useMemo(() => {
    if (!activeExecution) return null
    const total = activeExecution.checkpointIds?.length || 0
    const completed = activeExecution.completedCheckpoints?.length || 0
    if (total === 0) return 100
    return Math.round((completed / total) * 100)
  }, [activeExecution])

  const selectedGeofence = useMemo(() => {
    if (!activeExecution || !geofences || geofences.length === 0) return null
    const fence = geofences.find(g => g.id === activeExecution.geofenceId || g.name === activeExecution.geofenceName)
    if (!fence) return null
    const positions = fence.geometry?.coordinates?.[0]?.map(coord => ({ lat: coord[1], lng: coord[0] })) || []
    if (positions.length === 0) return null
    return {
      id: fence.id,
      name: fence.name,
      type: fence.type,
      polygon: positions
    }
  }, [activeExecution, geofences])

  const progressPercent = gpsTrack.length > 1
    ? Math.round((currentIndex / (gpsTrack.length - 1)) * 100)
    : 0

  const getScoreColor = (value) => {
    if (value >= 80) return 'score-display__circle--high'
    if (value >= 50) return 'score-display__circle--medium'
    return 'score-display__circle--low'
  }

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
        <div className="intelligence-hub__sidebar">

          {/* Phase 20.2: Activity Date Picker */}
          <div className="intelligence-card">
            <div className="intelligence-card__title">📅 Fecha de Operación</div>
            <ActivityDatePicker
              value={selectedDate}
              onChange={setSelectedDate}
              activeDates={activeDays}
              label="Seleccionar fecha"
            />
          </div>

          {/* Phase 20.3: Search + Execution Selector */}
          <div className="intelligence-card">
            <div className="intelligence-card__title">🔍 Buscar Ejecución</div>
            <input
              className="intel__search-input"
              type="text"
              placeholder="Buscar por guardia, código o ruta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div style={{ marginTop: '0.5rem' }}>
              <CustomSelect
                value={selectedExecutionId}
                onChange={setSelectedExecutionId}
                options={executionOptions}
                placeholder="— Seleccionar ejecución —"
              />
            </div>
            {selectedDate && filteredExecutions.length === 0 && (
              <div className="intel__no-data">
                <span className="intel__no-data-icon">📭</span>
                Sin ejecuciones para esta fecha
              </div>
            )}
          </div>

          {/* Phase 20.1: Spatial Context */}
          {activeExecution && (
            <div className="intelligence-card">
              <div className="intelligence-card__title">📍 Contexto Espacial</div>
              <div className="intel__context-hierarchy">
                {activeExecution.geofenceName && (
                  <div className="intel__context-row">
                    <span className="intel__context-label">Geocerca</span>
                    <span className="intel__context-value">{activeExecution.geofenceName}</span>
                  </div>
                )}
                {activeExecution.routeName && (
                  <div className="intel__context-row">
                    <span className="intel__context-label">Ruta</span>
                    <span className="intel__context-value">{activeExecution.routeName}</span>
                  </div>
                )}
                <div className="intel__context-row">
                  <span className="intel__context-label">Guardia</span>
                  <span className="intel__context-value">
                    <span className="intel__guard-code">{activeExecution.guardCode || '—'}</span>
                    {' '}{activeExecution.guardName || ''}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Phase 20.5: Operational Metrics */}
          {activeExecution && (
            <div className="intelligence-card">
              <div className="intelligence-card__title">📊 Métricas Operativas</div>
              <div className="intel__metrics">
                {durationMinutes !== null && (
                  <div className="intel__metric-row">
                    <span className="intel__metric-label">Duración Total</span>
                    <span className="intel__metric-value">{durationMinutes} min</span>
                  </div>
                )}
                {startStatus && (
                  <div className="intel__metric-row">
                    <span className="intel__metric-label">Estado de Inicio</span>
                    <span className={`intel__start-badge intel__start-badge--${startStatus}`}>
                      {startStatus === 'on_time' ? '✓ Tiempo Justo' : '⚠ Con Retraso'}
                    </span>
                  </div>
                )}
                {checkpointPercent !== null && (
                  <div className="intel__metric-row">
                    <span className="intel__metric-label">Ronda Efectuada</span>
                    <span className="intel__metric-value">{checkpointPercent}%</span>
                  </div>
                )}
                {adherence && (
                  <>
                    <div className="intel__metric-row">
                      <span className="intel__metric-label">Adherencia Ruta</span>
                      <span className="intel__metric-value intel__metric-value--primary">{adherence.adherencePercentage}%</span>
                    </div>
                    <div className="intel__metric-row">
                      <span className="intel__metric-label">Desviación Máx.</span>
                      <span className="intel__metric-value">{adherence.maxDeviationMeters}m</span>
                    </div>
                    <div className="intel__metric-row">
                      <span className="intel__metric-label">Desviaciones</span>
                      <span className="intel__metric-value">{adherence.deviationsCount}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Score Card */}
          {score && (
            <div className="intelligence-card">
              <div className="intelligence-card__title">🏆 Score Operacional</div>
              <div className="score-display">
                <div className={`score-display__circle ${getScoreColor(score.score)}`}>
                  {score.score}
                </div>
                <div className="score-display__details">
                  <div>📍 Adherencia: {score.breakdown.adherence}/50</div>
                  <div>✅ Checkpoints: {score.breakdown.checkpoints}/50</div>
                  {score.breakdown.penalties > 0 && (
                    <div style={{ color: '#ef4444' }}>⚠ Penalizaciones: -{score.breakdown.penalties}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Playback Map ─── */}
        <div className="intelligence-card intelligence-hub__map-card">
          <div className="intelligence-hub__map-header">
            <div className="intelligence-card__title" style={{ margin: 0 }}>
              Playback de Ronda {loadingMapData ? '(Cargando Chunks...)' : ''}
            </div>
          </div>

          <div className="intelligence-hub__map-container">
            <PlaybackMap
              track={gpsTrack}
              routeGeometry={routeGeometry}
              geofence={selectedGeofence}
              currentIndex={currentIndex}
            />
          </div>

          {/* Phase 20.4: Premium Playback Controls */}
          <div className="playback-controls">
            <div className="playback-controls__btns">
              <button
                className="playback-btn playback-btn--stop"
                onClick={handleStop}
                disabled={gpsTrack.length === 0}
                title="Detener"
              >
                ⏹
              </button>
              <button
                className="playback-btn playback-btn--play"
                onClick={isPlaying ? handlePause : handlePlay}
                disabled={gpsTrack.length === 0}
                title={isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
            </div>

            <input
              type="range"
              className="playback-slider"
              min="0"
              max={gpsTrack.length > 0 ? gpsTrack.length - 1 : 0}
              value={currentIndex}
              onChange={handleSliderChange}
              disabled={gpsTrack.length === 0}
            />

            <span className="playback-progress">{progressPercent}%</span>

            <div className="playback-speed">
              <CustomSelect
                value={playbackSpeed}
                onChange={(val) => setPlaybackSpeed(Number(val))}
                options={SPEED_OPTIONS}
                direction="up"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
