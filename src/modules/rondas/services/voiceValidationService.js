import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { convertWebmToWav } from '@/utils/audioUtils'

/**
 * Servicio para comunicarse con SentinelOps Voice API
 */
const VOICE_API_URL = import.meta.env.VITE_VOICE_API_URL || 'http://localhost:8000'

// ─── IndexedDB Adapter ───
const DB_NAME = 'SentinelOpsVoiceDB'
const STORE_NAME = 'enrollmentStore'

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const saveEnrollmentAudioLocally = async (blob) => {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(blob, 'enrolledVoice')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

const getEnrollmentAudioLocally = async () => {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get('enrolledVoice')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(tx.error)
  })
}

export const verifyVoiceIdentity = async (liveAudioBlob, enrollmentAudioUrl = null) => {
  try {
    // 1. Obtener la grabación histórica del dispositivo
    const enrolledWavBlob = await getEnrollmentAudioLocally()
    if (!enrolledWavBlob) {
      throw new Error("No se encontró el perfil de voz guardado en este dispositivo. Debe enrolarse nuevamente.")
    }

    // 2. Convertir la grabación en vivo actual
    const liveWavBlob = await convertWebmToWav(liveAudioBlob)

    const formData = new FormData()
    formData.append('live_audio', liveWavBlob, 'live_audio.wav')
    formData.append('enrollment_audio', enrolledWavBlob, 'enrollment_audio.wav')

    const response = await fetch(`${VOICE_API_URL}/verify-voice/`, {
      method: 'POST',
      body: formData,
      // No mandamos el header 'Content-Type', el navegador lo pone automáticamente para FormData
    })

    if (!response.ok) {
      throw new Error(`Error en el servidor de IA: ${response.status}`)
    }

    const data = await response.json()
    return data // Retornará { match: true, score: 0.92 }

  } catch (error) {
    console.error('[VoiceValidationService] Error de red:', error)
    throw error
  }
}

export const enrollVoiceIdentity = async (audioBlob, userId) => {
  try {
    // Simulated API Call to Python backend for testing phase
    const wavBlob = await convertWebmToWav(audioBlob)
    console.log(`[VoiceValidationService] Simulando enrolamiento de voz para usuario: ${userId}... Blob WAV generado de ${wavBlob.size} bytes.`)
    
    // 1. Guardar la voz original en la base de datos interna del celular
    await saveEnrollmentAudioLocally(wavBlob)

    // Simulamos 1.5 segundos de retraso de red y procesamiento de la IA
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Realizamos la actualización en Firestore
    const userRef = doc(db, 'users', userId)
    await updateDoc(userRef, {
      voiceEnrolled: true,
      enrolledAt: new Date().toISOString()
    })

    console.log('[VoiceValidationService] ¡Enrolamiento simulado con éxito!')
    return { success: true }
  } catch (error) {
    console.error('[VoiceValidationService] Error durante enrolamiento simulado:', error)
    throw error
  }
}
