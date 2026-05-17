import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth/context/AuthContext'
import { useIncidentReporting } from '@/modules/incidents/hooks/useIncidentReporting'
import { INCIDENT_TYPES, INCIDENT_SEVERITY } from '@/config/constants'
import './IncidentReportPage.css'

/**
 * IncidentReportPage — Guard mobile tactical interface
 * Fast, single-view form designed to take < 15s in the field
 */
export default function IncidentReportPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { reportIncident, isSubmitting, error, accuracy } = useIncidentReporting()
  
  const [type, setType] = useState(INCIDENT_TYPES.SECURITY)
  const [severity, setSeverity] = useState(INCIDENT_SEVERITY.MEDIUM)
  const [description, setDescription] = useState('')
  const [images, setImages] = useState([])
  const [previewUrls, setPreviewUrls] = useState([])
  
  const fileInputRef = useRef(null)

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      setImages((prev) => [...prev, ...files])
      
      const newUrls = files.map((f) => URL.createObjectURL(f))
      setPreviewUrls((prev) => [...prev, ...newUrls])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Auto-generate title based on type and timestamp
    const titleMap = {
      [INCIDENT_TYPES.SECURITY]: 'Reporte Seguridad',
      [INCIDENT_TYPES.MAINTENANCE]: 'Reporte Mantenimiento',
      [INCIDENT_TYPES.EMERGENCY]: 'Emergencia',
      [INCIDENT_TYPES.OBSERVATION]: 'Observación',
    }

    const result = await reportIncident({
      title: `${titleMap[type]} - ${new Date().toLocaleTimeString('es-BO', {hour: '2-digit', minute:'2-digit'})}`,
      description,
      type,
      severity,
      images,
      reportedBy: user.uid,
    })

    if (result.success) {
      navigate('/guard/mis-rondas', { replace: true })
    }
  }

  return (
    <div className="inc-report">
      <div className="inc-report__header">
        <h1 className="inc-report__title">Reportar Incidente</h1>
        <span className="inc-report__subtitle">Envío rápido geo-referenciado</span>
      </div>

      <form className="inc-report__form" onSubmit={handleSubmit}>
        
        {/* Type Selector */}
        <div className="inc-report__grid">
          <button type="button" 
            className={`inc-report__sel-btn ${type === INCIDENT_TYPES.SECURITY ? 'inc-report__sel-btn--active-type' : ''}`}
            onClick={() => setType(INCIDENT_TYPES.SECURITY)}>
            🛡️ Seguridad
          </button>
          <button type="button" 
            className={`inc-report__sel-btn ${type === INCIDENT_TYPES.MAINTENANCE ? 'inc-report__sel-btn--active-type' : ''}`}
            onClick={() => setType(INCIDENT_TYPES.MAINTENANCE)}>
            🔧 Mant.
          </button>
          <button type="button" 
            className={`inc-report__sel-btn ${type === INCIDENT_TYPES.EMERGENCY ? 'inc-report__sel-btn--active-type' : ''}`}
            onClick={() => setType(INCIDENT_TYPES.EMERGENCY)}>
            🚨 Emergencia
          </button>
          <button type="button" 
            className={`inc-report__sel-btn ${type === INCIDENT_TYPES.OBSERVATION ? 'inc-report__sel-btn--active-type' : ''}`}
            onClick={() => setType(INCIDENT_TYPES.OBSERVATION)}>
            👁️ Observación
          </button>
        </div>

        {/* Severity Selector */}
        <div className="inc-report__grid">
          <button type="button" 
            className={`inc-report__sel-btn ${severity === INCIDENT_SEVERITY.LOW ? 'inc-report__sel-btn--active-sev-low' : ''}`}
            onClick={() => setSeverity(INCIDENT_SEVERITY.LOW)}>
            Baja
          </button>
          <button type="button" 
            className={`inc-report__sel-btn ${severity === INCIDENT_SEVERITY.MEDIUM ? 'inc-report__sel-btn--active-sev-medium' : ''}`}
            onClick={() => setSeverity(INCIDENT_SEVERITY.MEDIUM)}>
            Media
          </button>
          <button type="button" 
            className={`inc-report__sel-btn ${severity === INCIDENT_SEVERITY.HIGH ? 'inc-report__sel-btn--active-sev-high' : ''}`}
            onClick={() => setSeverity(INCIDENT_SEVERITY.HIGH)}>
            Alta
          </button>
          <button type="button" 
            className={`inc-report__sel-btn ${severity === INCIDENT_SEVERITY.CRITICAL ? 'inc-report__sel-btn--active-sev-critical' : ''}`}
            onClick={() => setSeverity(INCIDENT_SEVERITY.CRITICAL)}>
            CRÍTICA
          </button>
        </div>

        {/* Description */}
        <textarea
          className="inc-report__input inc-report__textarea"
          placeholder="Descripción (opcional, sé breve)..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* Camera / Evidence */}
        <input 
          type="file" 
          accept="image/jpeg, image/png, image/webp" 
          capture="environment" 
          multiple
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handlePhotoSelect}
        />
        
        <button 
          type="button" 
          className="inc-report__photo-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          📷 Capturar Evidencia (Fotos)
        </button>

        {previewUrls.length > 0 && (
          <div className="inc-report__photo-preview">
            {previewUrls.map((url, i) => (
              <img key={i} src={url} alt={`Evidencia ${i}`} className="inc-report__photo-thumb" />
            ))}
          </div>
        )}

        {/* Submit */}
        {error && <div style={{ color: 'var(--color-danger-400)', fontSize: '12px' }}>{error}</div>}
        
        <button 
          type="submit" 
          className="inc-report__submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Enviando Reporte...' : 'ENVIAR REPORTE AL CENTRO DE COMANDO'}
        </button>

        <div className="inc-report__gps-status">
          {accuracy ? `📍 GPS: Precisión ±${accuracy.toFixed(0)}m` : '📍 Obteniendo GPS...'}
        </div>
      </form>
    </div>
  )
}
