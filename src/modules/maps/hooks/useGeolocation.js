import { useState, useEffect, useCallback, useRef } from 'react'
import { GPS_OPTIONS } from '@/config/constants'

/**
 * SentinelOps — useGeolocation Hook
 * Core GPS tracking hook with state management
 * 
 * Features:
 *   - Single position request
 *   - Continuous watch mode
 *   - Accuracy tracking
 *   - Error handling with user-friendly messages
 *   - Auto-cleanup on unmount
 * 
 * Prepared for: realtime tracking, checkpoint proximity, geocercas
 */

const LOG_PREFIX = '[useGeolocation]'

const ERROR_MESSAGES = {
  1: 'Permiso de ubicación denegado. Habilita el GPS en tu navegador.',
  2: 'Posición no disponible. Verifica tu señal GPS.',
  3: 'Tiempo de espera agotado. Reintenta en un lugar con mejor señal.',
}

export function useGeolocation(options = {}) {
  const {
    enableWatch = false,
    gpsOptions = GPS_OPTIONS,
    onPositionUpdate = null,
    onError = null,
  } = options

  const [position, setPosition] = useState(null)
  const [accuracy, setAccuracy] = useState(null)
  const [heading, setHeading] = useState(null)
  const [speed, setSpeed] = useState(null)
  const [timestamp, setTimestamp] = useState(null)
  const [error, setError] = useState(null)
  const [isTracking, setIsTracking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const watchIdRef = useRef(null)
  const positionHistoryRef = useRef([])

  /**
   * Process incoming position data
   */
  const handlePosition = useCallback(
    (geoPosition) => {
      const { latitude, longitude, accuracy: acc, heading: hdg, speed: spd } =
        geoPosition.coords

      const newPos = { lat: latitude, lng: longitude }

      setPosition(newPos)
      setAccuracy(acc)
      setHeading(hdg)
      setSpeed(spd)
      setTimestamp(geoPosition.timestamp)
      setError(null)
      setIsLoading(false)

      // Track position history (last 100 positions)
      positionHistoryRef.current = [
        ...positionHistoryRef.current.slice(-99),
        { ...newPos, accuracy: acc, timestamp: geoPosition.timestamp },
      ]

      console.log(`${LOG_PREFIX} Position: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${acc?.toFixed(0)}m)`)

      if (onPositionUpdate) {
        onPositionUpdate(newPos, geoPosition)
      }
    },
    [onPositionUpdate]
  )

  /**
   * Handle geolocation errors
   */
  const handleError = useCallback(
    (geoError) => {
      const message = ERROR_MESSAGES[geoError.code] || `Error GPS: ${geoError.message}`
      console.error(`${LOG_PREFIX} Error [${geoError.code}]: ${message}`)

      setError(message)
      setIsLoading(false)

      if (onError) {
        onError(message, geoError)
      }
    },
    [onError]
  )

  /**
   * Request a single position
   */
  const getCurrentPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización')
      return
    }

    setIsLoading(true)
    setError(null)
    console.log(`${LOG_PREFIX} Requesting current position...`)

    navigator.geolocation.getCurrentPosition(handlePosition, handleError, gpsOptions)
  }, [handlePosition, handleError, gpsOptions])

  /**
   * Start continuous GPS watching
   */
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización')
      return
    }

    if (watchIdRef.current !== null) {
      console.warn(`${LOG_PREFIX} Already tracking, ignoring start request`)
      return
    }

    setIsLoading(true)
    setError(null)
    setIsTracking(true)
    console.log(`${LOG_PREFIX} 🛰 Starting GPS tracking...`)

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      gpsOptions
    )
  }, [handlePosition, handleError, gpsOptions])

  /**
   * Stop GPS watching
   */
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
      setIsTracking(false)
      console.log(`${LOG_PREFIX} 🛑 GPS tracking stopped`)
    }
  }, [])

  /**
   * Get position history (for track/trail rendering)
   */
  const getPositionHistory = useCallback(() => {
    return [...positionHistoryRef.current]
  }, [])

  /**
   * Clear position history
   */
  const clearHistory = useCallback(() => {
    positionHistoryRef.current = []
  }, [])

  // Auto-start watch if enableWatch option is true
  useEffect(() => {
    if (enableWatch) {
      startTracking()
    }

    return () => {
      stopTracking()
    }
  }, [enableWatch, startTracking, stopTracking])

  return {
    // State
    position,
    accuracy,
    heading,
    speed,
    timestamp,
    error,
    isTracking,
    isLoading,

    // Actions
    getCurrentPosition,
    startTracking,
    stopTracking,
    getPositionHistory,
    clearHistory,

    // Computed
    hasPosition: !!position,
    isHighAccuracy: accuracy !== null && accuracy <= 20,
  }
}
