import { useState, useEffect, useCallback } from 'react'
import { recordVoiceValidation } from '@/modules/rondas/services/rondaExecutionService'
import './VoiceValidationModal.css'

/**
 * SentinelOps — Voice Validation Modal (Catar Seguridad Integral)
 * 
 * Full-screen biometric identity verification before starting a ronda.
 * Simulates Azure Speech / IA voice recognition.
 * 
 * Flow:
 *   1. Shows passphrase to read
 *   2. Guard presses mic button → "Grabando..." (3s)
 *   3. "Analizando con IA..." (2s)
 *   4. Result → calls recordVoiceValidation → transitions to IN_PROGRESS
 * 
 * @param {object} props
 * @param {string} props.executionId - Execution document ID
 * @param {string} props.passphrase - Phrase the guard must read
 * @param {string} props.guardName - Guard display name
 * @param {Function} props.onSuccess - Called when validation passes
 * @param {Function} props.onFail - Called when validation fails
 */
export default function VoiceValidationModal({ executionId, passphrase, guardName, onSuccess, onFail }) {
  const [phase, setPhase] = useState('idle') // idle | recording | analyzing | success | error
  const [progress, setProgress] = useState(0)
  const [matchScore, setMatchScore] = useState(null)

  // Simulate voice recording + analysis
  const startValidation = useCallback(async () => {
    setPhase('recording')
    setProgress(0)

    // Phase 1: Recording (3 seconds)
    const recordDuration = 3000
    const recordInterval = 50
    let elapsed = 0

    const recordTimer = setInterval(() => {
      elapsed += recordInterval
      setProgress(Math.min((elapsed / recordDuration) * 50, 50))

      if (elapsed >= recordDuration) {
        clearInterval(recordTimer)

        // Phase 2: AI Analysis (2 seconds)
        setPhase('analyzing')
        setProgress(50)

        const analyzeDuration = 2000
        let analyzeElapsed = 0

        const analyzeTimer = setInterval(() => {
          analyzeElapsed += recordInterval
          setProgress(50 + Math.min((analyzeElapsed / analyzeDuration) * 50, 50))

          if (analyzeElapsed >= analyzeDuration) {
            clearInterval(analyzeTimer)

            // Phase 3: Result (simulated 96% match)
            const score = 0.96
            setMatchScore(score)
            setPhase('success')
            setProgress(100)

            // Send to Firestore (async, non-blocking)
            recordVoiceValidation(executionId, {
              matchScore: score,
              passed: true,
              position: null,
            })
              .then(() => {
                setTimeout(() => {
                  if (onSuccess) onSuccess()
                }, 800)
              })
              .catch((err) => {
                console.error('[VoiceValidation] Error recording result:', err)
                setPhase('error')
                if (onFail) onFail(err)
              })
          }
        }, recordInterval)
      }
    }, recordInterval)
  }, [executionId, onSuccess, onFail])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      setPhase('idle')
      setProgress(0)
    }
  }, [])

  return (
    <div className="voice-modal" id="voice-validation-modal">
      <div className="voice-modal__overlay" />

      <div className="voice-modal__content">
        {/* Header */}
        <div className="voice-modal__header">
          <div className="voice-modal__shield">🛡</div>
          <h1 className="voice-modal__title">Control de Identidad</h1>
          <p className="voice-modal__subtitle">Verificación Biométrica Anti-Suplantación</p>
        </div>

        {/* Guard Info */}
        <div className="voice-modal__guard">
          <span className="voice-modal__guard-icon">👤</span>
          <span className="voice-modal__guard-name">{guardName || 'Guardia Operativo'}</span>
        </div>

        {/* Passphrase */}
        <div className="voice-modal__passphrase-section">
          <label className="voice-modal__passphrase-label">Frase de verificación:</label>
          <div className="voice-modal__passphrase">
            "{passphrase || 'Guardia Operacional empezando ronda'}"
          </div>
        </div>

        {/* Mic Button / Status */}
        <div className="voice-modal__action-area">
          {phase === 'idle' && (
            <button
              className="voice-modal__mic-btn voice-modal__mic-btn--ready"
              onClick={startValidation}
            >
              <span className="voice-modal__mic-icon">🎤</span>
              <span className="voice-modal__mic-label">Presiona para grabar</span>
            </button>
          )}

          {phase === 'recording' && (
            <div className="voice-modal__mic-btn voice-modal__mic-btn--recording">
              <span className="voice-modal__mic-icon voice-modal__mic-icon--pulse">🎤</span>
              <span className="voice-modal__mic-label">Grabando...</span>
              <div className="voice-modal__progress-bar">
                <div
                  className="voice-modal__progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {phase === 'analyzing' && (
            <div className="voice-modal__mic-btn voice-modal__mic-btn--analyzing">
              <span className="voice-modal__mic-icon voice-modal__mic-icon--spin">🔍</span>
              <span className="voice-modal__mic-label">Analizando con IA...</span>
              <div className="voice-modal__progress-bar">
                <div
                  className="voice-modal__progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {phase === 'success' && (
            <div className="voice-modal__result voice-modal__result--success">
              <span className="voice-modal__result-icon">✓</span>
              <span className="voice-modal__result-text">Identidad verificada</span>
              <span className="voice-modal__result-score">Confianza: {(matchScore * 100).toFixed(0)}%</span>
            </div>
          )}

          {phase === 'error' && (
            <div className="voice-modal__result voice-modal__result--error">
              <span className="voice-modal__result-icon">✕</span>
              <span className="voice-modal__result-text">Error de validación</span>
              <button className="voice-modal__retry-btn" onClick={startValidation}>
                Reintentar
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="voice-modal__footer">
          <span className="voice-modal__footer-text">
            Catar Seguridad Integral — SentinelOps v1.0
          </span>
        </div>
      </div>
    </div>
  )
}
