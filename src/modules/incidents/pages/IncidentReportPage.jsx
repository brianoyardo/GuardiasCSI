import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/modules/auth/context/AuthContext'
import { useIncidentReporting } from '@/modules/incidents/hooks/useIncidentReporting'
import { INCIDENT_TYPES, INCIDENT_SEVERITY } from '@/config/constants'
import './IncidentReportPage.css'

/**
 * IncidentReportPage — Guard mobile tactical interface
 * Fast, single-view form designed for field use. Premium redesign.
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
  const [activeExec, setActiveExec] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submitPhase, setSubmitPhase] = useState('idle') // idle | uploading | sending | done | error
  
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!user?.uid) return
    const q = query(
      collection(db, 'rondaExecutions'),
      where('guardId', '==', user.uid),
      where('status', 'in', ['in_progress', 'paused', 'validating_voice'])
    )
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setActiveExec({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() })
      } else {
        setActiveExec(null)
      }
    })
    return () => unsub()
  }, [user?.uid])

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      setImages((prev) => [...prev, ...files])
      const newUrls = files.map((f) => URL.createObjectURL(f))
      setPreviewUrls((prev) => [...prev, ...newUrls])
    }
  }

  const removePhoto = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
    setPreviewUrls((prev) => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitPhase('uploading')
    setUploadProgress(0)

    // Simulate upload progress while actual request runs
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 85) {
          clearInterval(progressInterval)
          return 85
        }
        return prev + (images.length > 0 ? 8 : 15)
      })
    }, 200)

    const titleMap = {
      [INCIDENT_TYPES.SECURITY]: 'Reporte Seguridad',
      [INCIDENT_TYPES.MAINTENANCE]: 'Reporte Mantenimiento',
      [INCIDENT_TYPES.EMERGENCY]: 'Emergencia',
      [INCIDENT_TYPES.OBSERVATION]: 'Observación',
    }

    try {
      setSubmitPhase('sending')
      const result = await reportIncident({
        title: `${titleMap[type]} - ${new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`,
        description,
        type,
        severity,
        images,
        reportedBy: user.uid,
        rondaId: activeExec?.rondaId || activeExec?.routeId || null,
        executionId: activeExec?.id || null,
        routeId: activeExec?.routeId || activeExec?.rondaId || null,
        routeName: activeExec?.routeName || null,
        geofenceName: activeExec?.geofenceName || null,
      })

      clearInterval(progressInterval)

      if (result.success) {
        setUploadProgress(100)
        setSubmitPhase('done')
        setTimeout(() => {
          navigate('/guard/mis-rondas', { replace: true })
        }, 1200)
      } else {
        setSubmitPhase('error')
        setUploadProgress(0)
      }
    } catch {
      clearInterval(progressInterval)
      setSubmitPhase('error')
      setUploadProgress(0)
    }
  }

  // Type configs
  const typeOptions = [
    { value: INCIDENT_TYPES.SECURITY,    emoji: '🛡️', label: 'Seguridad' },
    { value: INCIDENT_TYPES.MAINTENANCE, emoji: '🔧', label: 'Mantenimiento' },
    { value: INCIDENT_TYPES.EMERGENCY,   emoji: '🚨', label: 'Emergencia' },
    { value: INCIDENT_TYPES.OBSERVATION, emoji: '👁️', label: 'Observación' },
  ]

  const severityOptions = [
    { value: INCIDENT_SEVERITY.LOW,      label: 'Baja',    color: '#eab308' },
    { value: INCIDENT_SEVERITY.MEDIUM,   label: 'Media',   color: '#f97316' },
    { value: INCIDENT_SEVERITY.HIGH,     label: 'Alta',    color: '#ef4444' },
    { value: INCIDENT_SEVERITY.CRITICAL, label: 'Crítica', color: '#dc2626' },
  ]

  const isProcessing = submitPhase === 'uploading' || submitPhase === 'sending'

  return (
    <div className="inc-report" id="incident-report-page">

      {/* ─── Header ─── */}
      <div className="inc-report__header">
        <div className="inc-report__header-icon">⚠️</div>
        <div>
          <h1 className="inc-report__title">Reportar Incidente</h1>
          <span className="inc-report__subtitle">Envío rápido geo-referenciado</span>
        </div>
        {activeExec && (
          <div className="inc-report__active-badge">
            <span className="inc-report__active-dot" />
            Ronda Activa
          </div>
        )}
      </div>

      {/* ─── Progress bar (only visible when submitting) ─── */}
      {isProcessing || submitPhase === 'done' ? (
        <div className="inc-report__progress-wrap">
          <div className="inc-report__progress-bar">
            <div
              className={`inc-report__progress-fill ${submitPhase === 'done' ? 'inc-report__progress-fill--done' : ''}`}
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <div className="inc-report__progress-label">
            {submitPhase === 'uploading' && images.length > 0 && `Subiendo ${images.length} foto(s)...`}
            {submitPhase === 'sending' && 'Enviando al Centro de Comando...'}
            {submitPhase === 'done' && '✓ Reporte enviado exitosamente'}
          </div>
        </div>
      ) : null}

      <form className="inc-report__form" onSubmit={handleSubmit}>

        {/* ─── Type Selector ─── */}
        <div className="inc-report__section">
          <label className="inc-report__section-label">Tipo de Incidente</label>
          <div className="inc-report__type-grid">
            {typeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`inc-report__type-btn ${type === opt.value ? 'inc-report__type-btn--active' : ''}`}
                onClick={() => setType(opt.value)}
              >
                <span className="inc-report__type-emoji">{opt.emoji}</span>
                <span className="inc-report__type-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ─── Severity Selector ─── */}
        <div className="inc-report__section">
          <label className="inc-report__section-label">Nivel de Severidad</label>
          <div className="inc-report__sev-grid">
            {severityOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`inc-report__sev-btn ${severity === opt.value ? 'inc-report__sev-btn--active' : ''}`}
                style={severity === opt.value ? { borderColor: opt.color, color: opt.color, background: `${opt.color}18` } : {}}
                onClick={() => setSeverity(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Description ─── */}
        <div className="inc-report__section">
          <label className="inc-report__section-label">Descripción</label>
          <textarea
            className="inc-report__textarea"
            placeholder="Describa brevemente el incidente..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>

        {/* ─── Camera / Evidence ─── */}
        <div className="inc-report__section">
          <label className="inc-report__section-label">Evidencia Fotográfica</label>
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
            <span className="inc-report__photo-icon">📷</span>
            <span>
              {images.length > 0
                ? `${images.length} foto(s) seleccionada(s) — Añadir más`
                : 'Capturar / Seleccionar Fotos'}
            </span>
          </button>

          {previewUrls.length > 0 && (
            <div className="inc-report__photo-preview">
              {previewUrls.map((url, i) => (
                <div key={i} className="inc-report__thumb-wrap">
                  <img src={url} alt={`Evidencia ${i + 1}`} className="inc-report__photo-thumb" />
                  <button
                    type="button"
                    className="inc-report__thumb-remove"
                    onClick={() => removePhoto(i)}
                    aria-label="Eliminar foto"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Error ─── */}
        {(error || submitPhase === 'error') && (
          <div className="inc-report__error">
            ⚠️ {error || 'Error al enviar el reporte. Intente nuevamente.'}
          </div>
        )}

        {/* ─── GPS Status ─── */}
        <div className="inc-report__gps-status">
          <span className={`inc-report__gps-dot ${accuracy && accuracy <= 30 ? 'inc-report__gps-dot--ok' : 'inc-report__gps-dot--warn'}`} />
          {accuracy ? `GPS: ±${accuracy.toFixed(0)}m de precisión` : 'Obteniendo señal GPS...'}
        </div>

        {/* ─── Submit ─── */}
        <button
          type="submit"
          className={`inc-report__submit ${submitPhase === 'done' ? 'inc-report__submit--done' : ''}`}
          disabled={isProcessing || submitPhase === 'done'}
          id="submit-incident-btn"
        >
          {submitPhase === 'done' && '✓ Reporte Enviado'}
          {(submitPhase === 'uploading' || submitPhase === 'sending') && (
            <>
              <span className="inc-report__spinner" />
              Enviando...
            </>
          )}
          {(submitPhase === 'idle' || submitPhase === 'error') && '📡 Enviar Reporte al Centro de Comando'}
        </button>

      </form>
    </div>
  )
}
