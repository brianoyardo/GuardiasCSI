import { useState, useCallback } from 'react'
import { uploadEvidence } from '@/services/appwriteStorage'
import { createIncident } from '@/modules/incidents/services/incidentService'
import { useGeolocation } from '@/modules/maps/hooks'

/**
 * SentinelOps — useIncidentReporting Hook
 * Orchestrates: GPS + Appwrite Upload + Firestore Creation
 * 
 * Built for speed: fast mobile reporting (< 15s).
 * Prepared for offline queue and background uploads in the future.
 */

const LOG_PREFIX = '[useIncidentReporting]'

export function useIncidentReporting() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  
  // Use non-watching geolocation just to grab current position instantly
  const { position, accuracy, getCurrentPosition } = useGeolocation({ enableWatch: false })

  const reportIncident = useCallback(async (data) => {
    setIsSubmitting(true)
    setError(null)
    
    try {
      // 1. Ensure we have GPS
      let currentPos = position
      if (!currentPos) {
        currentPos = await getCurrentPosition()
      }
      
      if (!currentPos) {
        throw new Error('Ubicación GPS requerida para reportar incidentes.')
      }

      // 2. Upload images to Appwrite (if any)
      const evidenceIds = []
      if (data.images && data.images.length > 0) {
        for (const file of data.images) {
          const result = await uploadEvidence(file)
          if (result && result.fileId) evidenceIds.push(result.fileId)
        }
      }

      // 3. Create incident in Firestore
      const incidentId = await createIncident({
        title: data.title || 'Reporte de campo',
        description: data.description,
        type: data.type,
        severity: data.severity,
        reportedBy: data.reportedBy,
        location: currentPos,
        evidenceIds,
        rondaId: data.rondaId, // Optional: if reported during a ronda
        executionId: data.executionId, // Optional
      })

      console.log(`${LOG_PREFIX} ✅ Incident successfully reported: ${incidentId}`)
      return { success: true, incidentId }

    } catch (err) {
      console.error(`${LOG_PREFIX} Error reporting incident:`, err)
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setIsSubmitting(false)
    }
  }, [position, getCurrentPosition])

  return {
    reportIncident,
    isSubmitting,
    error,
    position,
    accuracy,
  }
}
