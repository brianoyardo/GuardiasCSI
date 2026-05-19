import { useState, useCallback } from 'react'
import { uploadEvidence } from '@/services/appwriteStorage'
import { createIncident } from '@/modules/incidents/services/incidentService'
import { useGeolocation } from '@/modules/maps/hooks'

/**
 * SentinelOps — useIncidentReporting Hook
 * Orchestrates: GPS + Appwrite Upload + Firestore Creation
 * 
 * Built for speed: fast mobile reporting (< 15s).
 * GPS-tolerant: forces a fresh read on submit, falls back to
 * dev coordinates in development mode if GPS is unavailable.
 */

const LOG_PREFIX = '[useIncidentReporting]'

const DEV_FALLBACK_POSITION = {
  lat: -16.5,
  lng: -68.15,
  accuracy: 999,
}

/**
 * Compress image file using canvas to reduce upload size
 * Skips compression for files under 1MB
 * @param {File} file - Original image file
 * @param {number} maxWidth - Max width in pixels
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<File>} Compressed JPEG file or original
 */
async function compressImage(file, maxWidth = 1200, quality = 0.7) {
  const ONE_MB = 1024 * 1024
  if (file.size < ONE_MB) {
    // console.log(`[compressImage] ${file.name}: ${(file.size / 1024).toFixed(0)}KB — skipping (under 1MB)`)
    return file
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('compressImage timeout (15s)')), 15000)

    try {
      const objectUrl = URL.createObjectURL(file)
      const img = new Image()

      img.onload = () => {
        URL.revokeObjectURL(objectUrl)

        try {
          const canvas = document.createElement('canvas')
          let { width, height } = img
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)
          canvas.toBlob(
            (blob) => {
              clearTimeout(timeout)
              if (!blob) {
                reject(new Error('Canvas toBlob returned null'))
                return
              }
              const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg') || 'image.jpg', {
                type: 'image/jpeg',
              })
              // console.log(`[compressImage] ${file.name}: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB`)
              resolve(compressed)
            },
            'image/jpeg',
            quality
          )
        } catch (err) {
          clearTimeout(timeout)
          reject(err)
        }
      }

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        clearTimeout(timeout)
        reject(new Error('Failed to load image'))
      }
      img.src = objectUrl
    } catch (err) {
      clearTimeout(timeout)
      reject(err)
    }
  })
}

/**
 * Force a fresh GPS read with timeout and error handling
 * @returns {Promise<{lat: number, lng: number, accuracy: number}>}
 */
async function forceGpsRead() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    )
  })
}

export function useIncidentReporting() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  
  const { position, accuracy, getCurrentPosition } = useGeolocation({ enableWatch: false })

  const reportIncident = useCallback(async (data) => {
    setIsSubmitting(true)
    setError(null)
    
    try {
      // 1. Ensure we have GPS — try cached first, then force fresh read
      let currentPos = position
      if (!currentPos) {
        try {
          currentPos = await getCurrentPosition()
        } catch (_) {
          // getCurrentPosition from hook failed, try direct read
        }
      }

      if (!currentPos) {
        try {
          currentPos = await forceGpsRead()
        } catch (gpsErr) {
          // GPS completely unavailable
          if (import.meta.env.DEV) {
            // Dev mode: use fallback coordinates so testing isn't blocked
            // console.warn(`${LOG_PREFIX} GPS unavailable, using dev fallback (La Paz center)`)
            currentPos = DEV_FALLBACK_POSITION
          } else {
            // Production: return clean error for UI display
            const message = gpsErr.code === 1
              ? 'Permiso de ubicación denegado. Active el GPS en la configuración de su dispositivo.'
              : gpsErr.code === 3
              ? 'Tiempo de espera agotado. Verifique que el GPS esté activo e intente nuevamente.'
              : 'No se pudo obtener la ubicación GPS. Verifique la configuración de su dispositivo.'

            return { success: false, error: message }
          }
        }
      }

      // 2. Upload images to Appwrite (if any) — send OS file directly (no Canvas compression)
      const evidenceIds = []
      if (data.images && data.images.length > 0) {
        for (const file of data.images) {
          try {
            const uploadFile = file
            const result = await uploadEvidence(uploadFile)
            if (result && result.fileId) evidenceIds.push(result.fileId)
          } catch (uploadErr) {
            //console.error(`${LOG_PREFIX} ⚠️ Failed to upload evidence:`, uploadErr)
          }
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
        rondaId: data.rondaId,
        executionId: data.executionId,
      })

      //console.log(`${LOG_PREFIX} ✅ Incident successfully reported: ${incidentId}`)
      return { success: true, incidentId }

    } catch (err) {
      //console.error(`${LOG_PREFIX} Error reporting incident:`, err)
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
