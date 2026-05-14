import { useState, useCallback, useRef } from 'react'
import { haversineDistance, calculateBearing } from '@/modules/maps/utils/geoUtils'

/**
 * SentinelOps — useMapTracking Hook
 * Position tracking with trail, speed, bearing calculations
 * 
 * Decoupled from GPS (receives position from useGeolocation).
 * Handles: trail management, metrics, playback preparation
 * 
 * Prepared for: realtime tracking, audit trail, route playback,
 *               Socket.IO/MQTT integration, anomaly detection
 */

const LOG_PREFIX = '[useMapTracking]'

const DEFAULT_OPTIONS = {
  maxTrailLength: 500,
  minDistanceBetweenPoints: 2, // meters, ignore micro-movements
  enableMetrics: true,
}

/**
 * @param {object} options
 * @param {number} [options.maxTrailLength=500]
 * @param {number} [options.minDistanceBetweenPoints=2]
 * @param {boolean} [options.enableMetrics=true]
 */
export function useMapTracking(options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options }

  const [trail, setTrail] = useState([])
  const [metrics, setMetrics] = useState({
    totalDistance: 0,
    currentSpeed: 0,
    averageSpeed: 0,
    bearing: 0,
    duration: 0,
    pointCount: 0,
  })
  const [isRecording, setIsRecording] = useState(false)

  const startTimeRef = useRef(null)
  const lastPointRef = useRef(null)
  const totalDistRef = useRef(0)

  /**
   * Add a new position to the trail
   * @param {{ lat: number, lng: number }} position
   * @param {number} [timestamp]
   */
  const addPosition = useCallback(
    (position, timestamp = Date.now()) => {
      if (!isRecording) return

      const lastPoint = lastPointRef.current

      // Filter micro-movements
      if (lastPoint) {
        const dist = haversineDistance(
          lastPoint.lat, lastPoint.lng,
          position.lat, position.lng
        )

        if (dist < config.minDistanceBetweenPoints) return

        totalDistRef.current += dist

        // Calculate metrics
        if (config.enableMetrics) {
          const timeDelta = (timestamp - lastPoint.timestamp) / 1000
          const speed = timeDelta > 0 ? dist / timeDelta : 0
          const bearing = calculateBearing(lastPoint, position)
          const duration = (timestamp - startTimeRef.current) / 1000
          const avgSpeed = duration > 0 ? totalDistRef.current / duration : 0

          setMetrics({
            totalDistance: totalDistRef.current,
            currentSpeed: speed,
            averageSpeed: avgSpeed,
            bearing,
            duration,
            pointCount: trail.length + 1,
          })
        }
      }

      const trackPoint = {
        lat: position.lat,
        lng: position.lng,
        timestamp,
      }

      lastPointRef.current = trackPoint

      setTrail((prev) => {
        const updated = [...prev, trackPoint]
        return updated.length > config.maxTrailLength
          ? updated.slice(-config.maxTrailLength)
          : updated
      })
    },
    [isRecording, config.minDistanceBetweenPoints, config.maxTrailLength, config.enableMetrics, trail.length]
  )

  /**
   * Start recording trail
   */
  const startRecording = useCallback(() => {
    console.log(`${LOG_PREFIX} 🔴 Recording started`)
    startTimeRef.current = Date.now()
    totalDistRef.current = 0
    lastPointRef.current = null
    setTrail([])
    setIsRecording(true)
    setMetrics({
      totalDistance: 0,
      currentSpeed: 0,
      averageSpeed: 0,
      bearing: 0,
      duration: 0,
      pointCount: 0,
    })
  }, [])

  /**
   * Stop recording and return trail data
   */
  const stopRecording = useCallback(() => {
    console.log(`${LOG_PREFIX} ⏹ Recording stopped (${trail.length} points, ${totalDistRef.current.toFixed(0)}m)`)
    setIsRecording(false)

    return {
      trail: [...trail],
      metrics: { ...metrics },
      startTime: startTimeRef.current,
      endTime: Date.now(),
    }
  }, [trail, metrics])

  /**
   * Clear trail without stopping
   */
  const clearTrail = useCallback(() => {
    setTrail([])
    totalDistRef.current = 0
    lastPointRef.current = null
  }, [])

  /**
   * Get trail as Leaflet-compatible polyline positions
   */
  const getPolylinePositions = useCallback(() => {
    return trail.map((p) => [p.lat, p.lng])
  }, [trail])

  return {
    trail,
    metrics,
    isRecording,
    addPosition,
    startRecording,
    stopRecording,
    clearTrail,
    getPolylinePositions,
  }
}
