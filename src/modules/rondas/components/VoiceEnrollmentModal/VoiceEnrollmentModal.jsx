import { useState, useRef, useEffect, useCallback } from 'react'
import { enrollVoiceIdentity } from '@/modules/rondas/services/voiceValidationService'
import { useAuth } from '@/modules/auth/context/AuthContext'
import HoldToTalkButton from '@/components/ui/HoldToTalkButton/HoldToTalkButton'
import './VoiceEnrollmentModal.css'

export default function VoiceEnrollmentModal({ onClose, onSuccess }) {
  const { user } = useAuth()
  const [phase, setPhase] = useState('idle') // idle | recording | analyzing | success | error
  const [error, setError] = useState(null)
  
  // MediaRecorder state
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Detener todas las pistas del micrófono para liberar el hardware
        stream.getTracks().forEach(track => track.stop())
        
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        chunksRef.current = [] // Vaciar chunks explícitamente
        processEnrollment(blob)
      }

      mediaRecorder.start()
      setPhase('recording')
      setError(null)
    } catch (err) {
      console.error('[VoiceEnrollment] Acceso al micrófono denegado:', err)
      setError('Se requiere acceso al micrófono para grabar.')
      setPhase('error')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  const processEnrollment = async (audioBlob) => {
    setPhase('analyzing')
    try {
      // Usar nuestro nuevo servicio para simular enrolamiento
      await enrollVoiceIdentity(audioBlob, user.uid)
      setPhase('success')
      setTimeout(() => {
        if (onSuccess) onSuccess()
      }, 1500)
    } catch (err) {
      setError(err.message || 'Error al procesar la huella de voz.')
      setPhase('error')
    }
  }

  // Cleanup microphone on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  return (
    <div className="voice-enroll-modal">
      <div className="voice-enroll-modal__overlay" onClick={() => phase === 'idle' && onClose()} />
      <div className="voice-enroll-modal__content">
        <div className="voice-enroll-modal__header">
          <div className="voice-enroll-modal__shield">🎙️</div>
          <h2 className="voice-enroll-modal__title">Registro de Voz</h2>
          <p className="voice-enroll-modal__subtitle">Enrola tu perfil biométrico por primera vez</p>
        </div>

        <div className="voice-enroll-modal__instructions">
          <p>Para garantizar la seguridad de tu cuenta, mantén presionado el botón de micrófono y lee en voz alta y clara el siguiente texto:</p>
          <div className="voice-enroll-modal__passphrase">
            "Yo confirmo mi identidad biométrica para el sistema SentinelOps."
          </div>
        </div>

        <div className="voice-enroll-modal__action-area">
          {(phase === 'idle' || phase === 'recording') && (
            <HoldToTalkButton
              isRecording={phase === 'recording'}
              disabled={false}
              onStartRecord={startRecording}
              onStopRecord={stopRecording}
            />
          )}

          {phase === 'analyzing' && (
            <div className="voice-enroll-modal__mic-btn voice-enroll-modal__mic-btn--analyzing">
              <span className="voice-enroll-modal__mic-icon voice-enroll-modal__mic-icon--spin">⚙️</span>
              <span className="voice-enroll-modal__mic-label">Procesando firma...</span>
            </div>
          )}

          {phase === 'success' && (
            <div className="voice-enroll-modal__result voice-enroll-modal__result--success">
              <span className="voice-enroll-modal__result-icon">✓</span>
              <span className="voice-enroll-modal__result-text">Perfil guardado exitosamente</span>
            </div>
          )}

          {phase === 'error' && (
            <div className="voice-enroll-modal__result voice-enroll-modal__result--error">
              <span className="voice-enroll-modal__result-icon">✕</span>
              <span className="voice-enroll-modal__result-text">{error}</span>
              <button className="voice-enroll-modal__retry-btn" onClick={() => setPhase('idle')}>
                Reintentar
              </button>
            </div>
          )}
        </div>

        {phase === 'idle' && (
          <button className="voice-enroll-modal__close-btn" onClick={onClose}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
