import { useState, useCallback } from 'react'
import { checkIn, checkOut, getGuardAttendance } from '@/modules/attendance/services/attendanceService'
import { useGeolocation } from '@/modules/maps/hooks'
import { useAuth } from '@/modules/auth/context/AuthContext'

/**
 * SentinelOps — useAttendance Hook
 * Orchestrates attendance marking with GPS
 */
export function useAttendance() {
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  
  const { position, accuracy, getCurrentPosition } = useGeolocation({ enableWatch: false })

  const handleAttendance = useCallback(async (type) => {
    setIsSubmitting(true)
    setError(null)

    try {
      if (!user?.uid) throw new Error('Usuario no autenticado')

      let currentPos = position
      if (!currentPos) {
        currentPos = await getCurrentPosition()
      }

      if (!currentPos) {
        throw new Error('GPS requerido para registrar asistencia')
      }

      if (type === 'check_in') {
        await checkIn(user.uid, currentPos)
      } else {
        await checkOut(user.uid, currentPos)
      }

      return { success: true }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setIsSubmitting(false)
    }
  }, [user, position, getCurrentPosition])

  const fetchHistory = useCallback(async () => {
    if (!user?.uid) return []
    return await getGuardAttendance(user.uid)
  }, [user])

  return {
    markCheckIn: () => handleAttendance('check_in'),
    markCheckOut: () => handleAttendance('check_out'),
    fetchHistory,
    isSubmitting,
    error,
    accuracy,
  }
}
