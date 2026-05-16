import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * SentinelOps — useRondaTimer Hook
 * Operational timer for ronda execution
 * 
 * Tracks: elapsed time, remaining time, urgency status
 * Prepared for: late detection, time-based alerts, scoring
 */

/**
 * @param {object} options
 * @param {number} [options.scheduledEnd] - Unix timestamp when ronda should end
 * @param {number} [options.startTime] - When execution started
 * @param {boolean} [options.isRunning=false] - Timer active
 * @param {number} [options.updateInterval=1000] - Ms between updates
 */
export function useRondaTimer(options = {}) {
  const {
    scheduledEnd = null,
    startTime = null,
    isRunning = false,
    updateInterval = 1000,
  } = options

  const [elapsed, setElapsed] = useState(0)
  const [remaining, setRemaining] = useState(null)
  const [isLate, setIsLate] = useState(false)
  const [urgency, setUrgency] = useState('normal')
  const intervalRef = useRef(null)
  const startRef = useRef(startTime || Date.now())

  useEffect(() => {
    if (startTime) startRef.current = startTime
  }, [startTime])

  const tick = useCallback(() => {
    const now = Date.now()
    const elapsedMs = now - startRef.current
    setElapsed(elapsedMs)

    if (scheduledEnd) {
      const remainMs = scheduledEnd - now
      setRemaining(Math.max(0, remainMs))
      setIsLate(remainMs < 0)

      if (remainMs < 0) {
        setUrgency('overdue')
      } else if (remainMs < 5 * 60 * 1000) {
        setUrgency('critical')
      } else if (remainMs < 15 * 60 * 1000) {
        setUrgency('warning')
      } else {
        setUrgency('normal')
      }
    }
  }, [scheduledEnd])

  useEffect(() => {
    if (!isRunning) return

    tick()
    intervalRef.current = setInterval(tick, updateInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isRunning, updateInterval])

  return {
    elapsed,
    remaining,
    isLate,
    urgency,
    elapsedFormatted: formatDuration(elapsed),
    remainingFormatted: remaining !== null ? formatDuration(remaining) : '--:--',
  }
}

/**
 * Format ms duration to HH:MM:SS
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  const totalSec = Math.floor(Math.abs(ms) / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const sign = ms < 0 ? '-' : ''

  if (h > 0) {
    return `${sign}${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${sign}${m}:${String(s).padStart(2, '0')}`
}
