import { useState, useRef, useEffect } from "react";
import HoldToTalkButton from "@/components/ui/HoldToTalkButton/HoldToTalkButton";
import { N8N_WEBHOOK_CIERRE_RONDA } from "@/config/n8n";
import "./EndRoundReportModal.css";


/**
 * Modal obligatorio para el reporte final de ronda (Voz -> n8n).
 */
export default function EndRoundReportModal({
  assignment,
  executionId,
  currentPosition,
  onComplete,
}) {
  const [phase, setPhase] = useState("idle"); // idle | recording | recorded | sending | error
  const [audioBlob, setAudioBlob] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const isStartingRef = useRef(false);

  const startRecording = async () => {
    if (isStartingRef.current || phase === "recording" || phase === "sending")
      return;
    isStartingRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setAudioBlob(null);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        chunksRef.current = [];
        if (blob.size < 1000) {
          setErrorMessage("Grabación muy corta. Inténtalo de nuevo.");
          setPhase("error");
          setAudioBlob(null);
        } else {
          setAudioBlob(blob);
          setPhase("recorded");
          setErrorMessage("");
        }
      };

      mediaRecorder.start();
      setPhase("recording");
    } catch (err) {
      console.error("[EndRound] Error al grabar:", err);
      setErrorMessage("No se pudo acceder al micrófono.");
      setPhase("error");
    } finally {
      isStartingRef.current = false;
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleSubmit = async () => {
    if (!audioBlob) return;
    setPhase("sending");

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "reporte.webm");

      const metadata = {
        assignmentId: assignment.id,
        executionId: executionId,
        guardId: assignment.guardId,
        guardCode: assignment.guardCode,
        guardName: assignment.guardName,
        rondaId: assignment.rondaId,
        routeName: assignment.routeName,
        geofenceName: assignment.geofenceName,
        location: {
          lat: currentPosition.lat,
          lng: currentPosition.lng,
          accuracy: currentPosition.accuracy || 5,
        },
        incidentTemplate: {
          reportedBy: "Agente IA - n8n",
          type: "security",
          severity: "medium",
          tags: ["Reporte IA", "Audio-Transcrito"],
        },
      };

      formData.append("metadata", JSON.stringify(metadata));

      if (!N8N_WEBHOOK_CIERRE_RONDA) {
        throw new Error('URL de cierre de ronda no configurada. Verifica VITE_N8N_BASE_URL en .env.')
      }

      const response = await fetch(
        N8N_WEBHOOK_CIERRE_RONDA,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error("El servidor rechazó el reporte.");
      }

      // Si todo fue bien
      if (onComplete) onComplete();
    } catch (err) {
      console.error("[EndRound] Error al enviar reporte:", err);
      setErrorMessage("Hubo un problema al enviar el reporte. Reintenta.");
      setPhase("error");
    }
  };

  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="end-modal">
      <div className="end-modal__overlay" />

      <div className="end-modal__content">
        <div className="end-modal__shield">🎙️</div>
        <div>
          <h1 className="end-modal__title">Reporte Operativo</h1>
          <p className="end-modal__subtitle">Cierre de Ronda</p>
        </div>

        <div className="end-modal__info">
          <div className="end-modal__info-row">
            <span className="end-modal__info-label">Guardia:</span>
            <span className="end-modal__info-value">
              {assignment?.guardName || "Guardia"}
            </span>
          </div>
          <div className="end-modal__info-row">
            <span className="end-modal__info-label">Ruta:</span>
            <span className="end-modal__info-value">
              {assignment?.routeName || "Desconocida"}
            </span>
          </div>
        </div>

        <div className="end-modal__action-area">
          {(phase === "idle" ||
            phase === "recording" ||
            phase === "recorded" ||
            phase === "error") && (
            <div className="end-modal__mic-container">
              <HoldToTalkButton
                isRecording={phase === "recording"}
                disabled={false}
                onStartRecord={startRecording}
                onStopRecord={stopRecording}
              />
              <div style={{ textAlign: "center", marginTop: "10px" }}>
                {phase === "recording" && (
                  <span style={{ color: "#ef4444" }}>Grabando...</span>
                )}
                {phase === "recorded" && (
                  <span style={{ color: "#22c55e" }}>
                    ¡Audio capturado! Listo para enviar.
                  </span>
                )}
                {phase === "error" && (
                  <span style={{ color: "#ef4444" }}>{errorMessage}</span>
                )}
                {phase === "idle" && (
                  <span style={{ color: "#888" }}>
                    Mantén presionado para grabar reporte
                  </span>
                )}
              </div>
            </div>
          )}

          {phase === "sending" && (
            <div className="end-modal__mic-btn end-modal__mic-btn--sending">
              <span className="end-modal__mic-icon">⏳</span>
              <span className="end-modal__mic-label">
                Enviando a Cerebro IA...
              </span>
            </div>
          )}
        </div>

        <div className="end-modal__footer-actions">
          <button
            className="end-modal__submit-btn"
            disabled={!audioBlob || phase === "sending"}
            onClick={handleSubmit}
          >
            {phase === "sending" ? "Procesando..." : "Enviar y Cerrar Ronda"}
          </button>
        </div>
      </div>
    </div>
  );
}
