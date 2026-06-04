import React from 'react';
import './HoldToTalkButton.css';

/**
 * HoldToTalkButton
 * 
 * Un componente de botón táctil premium diseñado para prevenir 
 * que la grabación se quede "pegada" en dispositivos móviles.
 * 
 * @param {boolean} isRecording - Estado actual de la grabación
 * @param {boolean} disabled - Si el botón está deshabilitado
 * @param {function} onStartRecord - Se llama cuando el usuario presiona el botón
 * @param {function} onStopRecord - Se llama cuando el usuario suelta el botón o se sale del área
 */
export default function HoldToTalkButton({ isRecording, disabled, onStartRecord, onStopRecord }) {
  // Manejo unificado de todos los eventos de fin de pulsación
  const handleStop = (e) => {
    e.preventDefault(); // Previene comportamientos default del navegador
    if (isRecording && onStopRecord) {
      onStopRecord();
    }
  };

  const handleStart = (e) => {
    e.preventDefault();
    if (!disabled && !isRecording && onStartRecord) {
      onStartRecord();
    }
  };

  return (
    <button
      className={`hold-to-talk-btn ${isRecording ? 'hold-to-talk-btn--recording' : 'hold-to-talk-btn--ready'} ${disabled ? 'hold-to-talk-btn--disabled' : ''}`}
      onPointerDown={handleStart}
      onPointerUp={handleStop}
      onPointerLeave={handleStop}
      onPointerCancel={handleStop} // Muy importante en móvil cuando el navegador cancela el touch
      onContextMenu={(e) => e.preventDefault()} // Previene menú de "Copiar/Pegar" o "Guardar imagen"
      disabled={disabled}
      type="button"
    >
      <span className={`hold-to-talk-icon ${isRecording ? 'hold-to-talk-icon--pulse' : ''}`}>
        🎤
      </span>
      <span className="hold-to-talk-label">
        {isRecording ? 'Grabando... Suelta para finalizar' : 'Mantener presionado'}
      </span>
      
      {/* Efectos visuales de ripple/pulso cuando graba */}
      {isRecording && (
        <>
          <div className="hold-to-talk-ripple hold-to-talk-ripple-1"></div>
          <div className="hold-to-talk-ripple hold-to-talk-ripple-2"></div>
        </>
      )}
    </button>
  );
}
