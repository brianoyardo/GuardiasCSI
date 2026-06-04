import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { convertWebmToWav } from '@/utils/audioUtils'

/**
 * Servicio para comunicarse con SentinelOps Voice API
 */
const VOICE_API_URL = 'http://localhost:8000'

export const verifyVoiceIdentity = async (liveAudioBlob, enrollmentAudioUrl = null) => {
  try {
    const wavBlob = await convertWebmToWav(liveAudioBlob)
    const formData = new FormData()
    
    // El audio que el guardia acaba de grabar en su celular
    formData.append('live_audio', wavBlob, 'live_audio.wav')
    
    // NOTA: Como la API espera un 'enrollment_audio', y aún no tenemos 
    // la URL real del perfil del guardia, mandaremos el mismo audio dos veces
    // para engañar a la API temporalmente y que no nos dé un error 422.
    formData.append('enrollment_audio', wavBlob, 'mock_enrollment.wav')

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
