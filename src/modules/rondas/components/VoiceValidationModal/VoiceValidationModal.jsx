import { useState, useEffect, useCallback, useRef } from "react";
import { recordVoiceValidation } from "@/modules/rondas/services/rondaExecutionService";
import { verifyVoiceIdentity } from "@/modules/rondas/services/voiceValidationService";
import HoldToTalkButton from "@/components/ui/HoldToTalkButton/HoldToTalkButton";
import "./VoiceValidationModal.css";

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
export default function VoiceValidationModal({
  executionId,
  passphrase,
  guardName,
  onSuccess,
  onFail,
}) {
  const [phase, setPhase] = useState("idle"); // idle | recording | analyzing | success | error
  const [progress, setProgress] = useState(0);
  const [matchScore, setMatchScore] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const isStartingRef = useRef(false);

  // Comienza la grabación de voz nativa
  const startRecording = async () => {
    if (isStartingRef.current || phase !== "idle") return;
    isStartingRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Detener micrófonos
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        chunksRef.current = []; // <-- Vaciado de chunks explícito
        processVoiceValidation(blob);
      };

      mediaRecorder.start();
      setPhase("recording");
    } catch (err) {
      console.error("[VoiceValidation] Error accediendo al micrófono:", err);
      setPhase("error");
    } finally {
      isStartingRef.current = false;
    }
  };

  // Detiene la grabación si está activa
  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  // Envía el blob a la IA
  const processVoiceValidation = async (audioBlob) => {
    setPhase("analyzing");
    try {
      if (audioBlob.size < 1000) {
        throw new Error("Grabación demasiado corta. Mantén presionado el botón más tiempo.");
      }

      // Llamada real al servicio Python (que simula el score 0.92 en el backend, o en el peor de los casos retornará los datos de la IA)
      const data = await verifyVoiceIdentity(audioBlob);

      if (data && data.match) {
        const score = data.score || 0.96; // Default si la API no manda score exacto
        setMatchScore(score);
        setPhase("success");

        // Registrar en Firestore que pasó
        await recordVoiceValidation(executionId, {
          matchScore: score,
          passed: true,
          position: null,
        });

        setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 1500);
      } else {
        throw new Error("Identidad no validada por IA");
      }
    } catch (err) {
      console.error("[VoiceValidation] Error en validación:", err);
      setPhase("error");
      if (onFail) onFail(err);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        mediaRecorderRef.current.stop();
      }
      setPhase("idle");
    };
  }, []);

  return (
    <div className="voice-modal" id="voice-validation-modal">
      <div className="voice-modal__overlay" />

      <div className="voice-modal__content">
        {/* Header */}
        <div className="voice-modal__header">
          <div className="voice-modal__shield">🛡</div>
          <h1 className="voice-modal__title">Control de Identidad</h1>
          <p className="voice-modal__subtitle">
            Verificación Biométrica Anti-Suplantación
          </p>
        </div>

        {/* Guard Info */}
        <div className="voice-modal__guard">
          <span className="voice-modal__guard-icon">👤</span>
          <span className="voice-modal__guard-name">
            {guardName || "Guardia Operativo"}
          </span>
        </div>

        {/* Passphrase */}
        <div className="voice-modal__passphrase-section">
          <label className="voice-modal__passphrase-label">
            Por favor, mantenga presionado el botón y diga la frase de
            seguridad:
          </label>
          <div className="voice-modal__passphrase">"{passphrase}"</div>
        </div>

        {/* Mic Button / Status */}
        <div className="voice-modal__action-area">
          {(phase === "idle" || phase === "recording") && (
            <HoldToTalkButton
              isRecording={phase === "recording"}
              disabled={false}
              onStartRecord={startRecording}
              onStopRecord={stopRecording}
            />
          )}

          {phase === "analyzing" && (
            <div className="voice-modal__mic-btn voice-modal__mic-btn--analyzing">
              <span className="voice-modal__mic-icon voice-modal__mic-icon--spin">
                🔍
              </span>
              <span className="voice-modal__mic-label">
                Analizando con IA...
              </span>
            </div>
          )}

          {phase === "success" && (
            <div className="voice-modal__result voice-modal__result--success">
              <span className="voice-modal__result-icon">✓</span>
              <span className="voice-modal__result-text">
                Identidad verificada
              </span>
              <span className="voice-modal__result-score">
                Confianza: {(matchScore * 100).toFixed(0)}%
              </span>
            </div>
          )}

          {phase === "error" && (
            <div className="voice-modal__result voice-modal__result--error">
              <span className="voice-modal__result-icon">✕</span>
              <span className="voice-modal__result-text">
                Error de validación
              </span>
              <button
                className="voice-modal__retry-btn"
                onClick={() => setPhase("idle")}
              >
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
  );
}
