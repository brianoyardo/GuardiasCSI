import { useEffect, useMemo, useRef, useState } from 'react'
import { auth } from '../services/firebase'
import MapView from '../components/MapView'
import { getCheckpoints } from '../services/checkpoints'
import {
  getCompletedCheckpoints,
  saveCheckpointProgress,
} from '../services/routeProgress'
import { calculateDistance } from '../utils/distance'

const MAX_DISTANCE_METERS = 20

export default function Dashboard() {
  const [userPosition, setUserPosition] = useState(null)
  const [checkpoints, setCheckpoints] = useState([])
  const [completedCheckpointIds, setCompletedCheckpointIds] = useState([])
  const [loadingPoints, setLoadingPoints] = useState(true)
  const [loadingLocation, setLoadingLocation] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [watchId, setWatchId] = useState(null)
  const [isAutoCompleting, setIsAutoCompleting] = useState(false)

  const user = auth.currentUser
  const autoCompleteLockRef = useRef(false)

  useEffect(() => {
    loadCheckpoints()

    if (user) {
      loadCompletedProgress()
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [])

  const nextCheckpoint = useMemo(() => {
    return (
      checkpoints.find((point) => !completedCheckpointIds.includes(point.id)) ||
      null
    )
  }, [checkpoints, completedCheckpointIds])

  const distanceToNextCheckpoint = useMemo(() => {
    if (!userPosition || !nextCheckpoint) return null

    return calculateDistance(
      userPosition.lat,
      userPosition.lng,
      nextCheckpoint.lat,
      nextCheckpoint.lng
    )
  }, [userPosition, nextCheckpoint])

  const isWithinRange =
    distanceToNextCheckpoint !== null &&
    distanceToNextCheckpoint <= MAX_DISTANCE_METERS

  useEffect(() => {
    const tryAutoComplete = async () => {
      if (!user || !userPosition || !nextCheckpoint) return
      if (!isWithinRange) return
      if (autoCompleteLockRef.current) return

      autoCompleteLockRef.current = true
      setIsAutoCompleting(true)

      try {
        const result = await saveCheckpointProgress({
          userId: user.uid,
          checkpointId: nextCheckpoint.id,
          lat: userPosition.lat,
          lng: userPosition.lng,
        })

        if (!result.alreadyExists) {
          const updatedCompleted = [...completedCheckpointIds, nextCheckpoint.id]
          setCompletedCheckpointIds(updatedCompleted)

          if (updatedCompleted.length === checkpoints.length) {
            setActionMessage('Ruta completada correctamente.')
          } else {
            setActionMessage(`Checkpoint "${nextCheckpoint.name}" completado automáticamente.`)
          }
        }
      } catch (error) {
        console.error('Error autocompletando checkpoint:', error)
        setActionMessage('No se pudo guardar el checkpoint automáticamente.')
      } finally {
        setIsAutoCompleting(false)
        setTimeout(() => {
          autoCompleteLockRef.current = false
        }, 1500)
      }
    }

    tryAutoComplete()
  }, [
    user,
    userPosition,
    nextCheckpoint,
    isWithinRange,
    completedCheckpointIds,
    checkpoints.length,
  ])

  const loadCheckpoints = async () => {
    try {
      const data = await getCheckpoints()
      setCheckpoints(data)
    } catch (error) {
      console.error('Error cargando checkpoints:', error)
      setActionMessage('No se pudieron cargar los checkpoints.')
    } finally {
      setLoadingPoints(false)
    }
  }

  const loadCompletedProgress = async () => {
    if (!user) return

    try {
      const completed = await getCompletedCheckpoints(user.uid)
      setCompletedCheckpointIds(completed.map((item) => item.checkpointId))
    } catch (error) {
      console.error('Error cargando progreso:', error)
    }
  }

  const startLocationTracking = () => {
    setActionMessage('')
    setLoadingLocation(true)

    if (!navigator.geolocation) {
      setLocationError('Tu navegador no soporta geolocalización')
      setLoadingLocation(false)
      return
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        setUserPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setLocationError('')
        setLoadingLocation(false)
      },
      (error) => {
        console.error('Error de geolocalización:', error)
        setLocationError('No se pudo obtener la ubicación')
        setLoadingLocation(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )

    setWatchId(id)
  }

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <h2 style={styles.sidebarTitle}>Ronda activa</h2>

        <div style={styles.block}>
          <p style={styles.label}>Usuario</p>
          <p style={styles.value}>{user?.email || 'Sin sesión'}</p>
        </div>

        <div style={styles.block}>
          <p style={styles.label}>Ubicación</p>
          {loadingLocation ? (
            <p style={styles.value}>Activando GPS...</p>
          ) : locationError ? (
            <p style={styles.error}>{locationError}</p>
          ) : userPosition ? (
            <p style={styles.success}>Ubicación detectada</p>
          ) : (
            <p style={styles.value}>Aún no activada</p>
          )}

          <button style={styles.button} onClick={startLocationTracking}>
            Iniciar ronda
          </button>
        </div>

        <div style={styles.block}>
          <p style={styles.label}>Checkpoints</p>
          {loadingPoints ? (
            <p style={styles.value}>Cargando puntos...</p>
          ) : (
            <p style={styles.value}>
              {completedCheckpointIds.length} / {checkpoints.length} completados
            </p>
          )}
        </div>

        <div style={styles.block}>
          <p style={styles.label}>Siguiente checkpoint</p>
          {nextCheckpoint ? (
            <>
              <p style={styles.value}>{nextCheckpoint.name}</p>
              <p style={styles.smallText}>
                Distancia:{' '}
                {distanceToNextCheckpoint !== null
                  ? `${distanceToNextCheckpoint.toFixed(1)} m`
                  : 'sin calcular'}
              </p>
              <p style={isWithinRange ? styles.success : styles.warning}>
                {isWithinRange
                  ? 'Dentro del rango permitido'
                  : 'Debes acercarte más'}
              </p>
              {isAutoCompleting && (
                <p style={styles.smallText}>Guardando checkpoint automáticamente...</p>
              )}
            </>
          ) : (
            <p style={styles.success}>Todos los checkpoints están completos</p>
          )}
        </div>

        {actionMessage && (
          <div style={styles.block}>
            <p style={styles.label}>Estado</p>
            <p style={styles.value}>{actionMessage}</p>
          </div>
        )}

        <div style={styles.block}>
          <p style={styles.label}>Lista de puntos</p>
          <div style={styles.pointsList}>
            {checkpoints.map((point) => {
              const isCompleted = completedCheckpointIds.includes(point.id)

              return (
                <div key={point.id} style={styles.pointCard}>
                  <strong>
                    {point.order}. {point.name}
                  </strong>
                  <span>{isCompleted ? 'Completado' : 'Pendiente'}</span>
                </div>
              )
            })}
          </div>
        </div>
      </aside>

      <main style={styles.mapSection}>
        <div style={styles.mapCard}>
          <MapView
            userPosition={userPosition}
            checkpoints={checkpoints}
            completedCheckpointIds={completedCheckpointIds}
          />
        </div>
      </main>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    gridTemplateColumns: '340px 1fr',
    background: '#f3f6fb',
  },
  sidebar: {
    background: '#ffffff',
    padding: '24px',
    borderRight: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  sidebarTitle: {
    margin: 0,
    fontSize: '24px',
  },
  block: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    padding: '14px',
  },
  label: {
    margin: '0 0 8px 0',
    fontSize: '13px',
    color: '#6b7280',
  },
  value: {
    margin: 0,
    fontSize: '15px',
    color: '#111827',
  },
  smallText: {
    margin: '8px 0 0 0',
    fontSize: '13px',
    color: '#6b7280',
  },
  success: {
    margin: '8px 0 0 0',
    color: '#067647',
    fontWeight: 600,
  },
  warning: {
    margin: '8px 0 0 0',
    color: '#b54708',
    fontWeight: 600,
  },
  error: {
    margin: 0,
    color: '#b42318',
    fontWeight: 600,
  },
  button: {
    marginTop: '12px',
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: 'none',
    background: '#111827',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
  },
  pointsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '10px',
  },
  pointCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px',
    borderRadius: '10px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    fontSize: '14px',
  },
  mapSection: {
    padding: '20px',
  },
  mapCard: {
    height: 'calc(100vh - 40px)',
    minHeight: '500px',
    background: '#fff',
    borderRadius: '20px',
    padding: '12px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
}