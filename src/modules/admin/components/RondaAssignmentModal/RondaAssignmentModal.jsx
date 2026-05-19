import { useState, useCallback, useRef, useEffect } from 'react'
import { FaCalendarAlt } from 'react-icons/fa'
import CustomSelect from '@/components/ui/CustomSelect/CustomSelect'
import './RondaAssignmentModal.css'

export default function RondaAssignmentModal({ guards, routes, onSubmit, onClose }) {
  const [form, setForm] = useState({
    guardId: '',
    routeId: '',
    scheduledStart: '',
    priority: 'normal',
    notes: '',
    strictTimeSync: true,
  })
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringEndDate, setRecurringEndDate] = useState('')
  const modalRef = useRef(null)

  const guardOptions = guards.map(g => ({
    value: g.uid || g.id,
    label: `${g.fullName || g.email}${g.guardId ? ` (${g.guardId})` : ''}`,
  }))

  const routeOptions = routes.map(r => ({
    value: r.id,
    label: r.name,
  }))

  const priorityOptions = [
    { value: 'low', label: '🟢 Baja' },
    { value: 'normal', label: '🔵 Normal' },
    { value: 'high', label: '🟠 Alta' },
    { value: 'urgent', label: '🔴 Urgente' },
  ]

  const handleClose = useCallback(() => {
    if (isDirty && !window.confirm('Tienes cambios sin guardar. ¿Seguro que quieres cerrar?')) return
    onClose()
  }, [isDirty, onClose])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        handleClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClose])

  const validateDate = (value) => {
    if (!value) return 'Fecha y hora requerida'
    const selectedTime = new Date(value).getTime()
    const now = Date.now()
    const oneMinute = 60 * 1000
    if (selectedTime < (now - oneMinute)) {
      return 'No puedes programar una ronda en el pasado'
    }
    if (isRecurring && !recurringEndDate) {
      return 'Selecciona una fecha de fin para la repetición'
    }
    if (isRecurring && recurringEndDate) {
      const endDate = new Date(recurringEndDate).setHours(
        new Date(value).getHours(),
        new Date(value).getMinutes(),
        0, 0
      )
      if (endDate <= selectedTime) {
        return 'La fecha de fin debe ser posterior a la fecha de inicio'
      }
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const dateError = validateDate(form.scheduledStart)
    if (dateError) {
      setError(dateError)
      return
    }

    if (!form.guardId || !form.routeId) {
      setError('Selecciona guardia y ruta')
      return
    }

    setIsSubmitting(true)

    try {
      if (isRecurring) {
        const startTs = new Date(form.scheduledStart).getTime()
        const endTs = new Date(recurringEndDate).setHours(
          new Date(form.scheduledStart).getHours(),
          new Date(form.scheduledStart).getMinutes(),
          0, 0
        )
        const oneDay = 24 * 60 * 60 * 1000
        const assignmentsToCreate = []

        for (let currentTs = startTs; currentTs <= endTs; currentTs += oneDay) {
          assignmentsToCreate.push({
            guardId: form.guardId,
            routeId: form.routeId,
            rondaId: form.routeId,
            scheduledStart: currentTs,
            scheduledEnd: currentTs + (90 * 60 * 1000),
            priority: form.priority,
            notes: form.notes,
            strictTimeSync: form.strictTimeSync,
          })
        }

        if (assignmentsToCreate.length > 30) {
          setError('No puedes programar más de 30 días a la vez.')
          setIsSubmitting(false)
          return
        }

        await onSubmit(assignmentsToCreate, true)
      } else {
        const startTs = new Date(form.scheduledStart).getTime()
        const endTs = startTs + (90 * 60 * 1000)

        await onSubmit({
          guardId: form.guardId,
          routeId: form.routeId,
          rondaId: form.routeId,
          scheduledStart: startTs,
          scheduledEnd: endTs,
          priority: form.priority,
          notes: form.notes,
          strictTimeSync: form.strictTimeSync,
        }, false)
      }
    } catch (err) {
      setError('Error al crear asignación')
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
    if (field === 'scheduledStart') {
      const err = validateDate(value)
      setError(err)
    }
  }

  return (
    <div className="assignment-modal-overlay" id="assignment-modal">
      <div className="assignment-modal" ref={modalRef}>
        {/* Header */}
        <div className="assignment-modal__header">
          <h2 className="assignment-modal__title">Asignar Nueva Ronda</h2>
          <button className="assignment-modal__close" onClick={handleClose} aria-label="Cerrar">✕</button>
        </div>

        {/* Error */}
        {error && (
          <div className="assignment-modal__error">{error}</div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="assignment-modal__form">
          {/* Guardia */}
          <div className="assignment-modal__field">
            <label className="assignment-modal__label">Guardia *</label>
            <CustomSelect
              value={form.guardId}
              onChange={(val) => updateField('guardId', val)}
              options={guardOptions}
              placeholder="Seleccionar guardia..."
            />
          </div>

          {/* Ruta */}
          <div className="assignment-modal__field">
            <label className="assignment-modal__label">Ruta *</label>
            <CustomSelect
              value={form.routeId}
              onChange={(val) => updateField('routeId', val)}
              options={routeOptions}
              placeholder="Seleccionar ruta..."
            />
          </div>

          {/* Fecha/Hora */}
          <div className="assignment-modal__field">
            <label className="assignment-modal__label">Fecha y Hora Programada *</label>
            <div className="assignment-modal__datetime-wrapper">
              <FaCalendarAlt className="assignment-modal__datetime-icon" />
              <input
                type="datetime-local"
                className="assignment-modal__datetime-input"
                value={form.scheduledStart}
                onChange={(e) => updateField('scheduledStart', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Prioridad */}
          <div className="assignment-modal__field">
            <label className="assignment-modal__label">Prioridad</label>
            <CustomSelect
              value={form.priority}
              onChange={(val) => updateField('priority', val)}
              options={priorityOptions}
            />
          </div>

          {/* Notas */}
          <div className="assignment-modal__field">
            <label className="assignment-modal__label">Indicaciones (Opcional)</label>
            <textarea
              className="assignment-modal__textarea"
              placeholder="Instrucciones especiales para el guardia..."
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={3}
            />
          </div>

          {/* Strict Time Sync Toggle */}
          <div className="assignment-modal__field assignment-modal__field--toggle">
            <label className="assignment-modal__toggle">
              <input
                type="checkbox"
                checked={form.strictTimeSync}
                onChange={(e) => updateField('strictTimeSync', e.target.checked)}
              />
              <span className="assignment-modal__toggle-slider" />
              <span className="assignment-modal__toggle-label">
                🌐 Forzar Reloj Global API (Anti-Fraude)
              </span>
            </label>
          </div>

          {/* Separator: Advanced Options */}
          <div className="assignment-modal__separator">
            <span>Opciones Avanzadas</span>
          </div>

          {/* Recurring Toggle */}
          <div className="assignment-modal__field assignment-modal__field--toggle">
            <label className="assignment-modal__toggle">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => {
                  setIsRecurring(e.target.checked)
                  setIsDirty(true)
                  if (!e.target.checked) setRecurringEndDate('')
                }}
              />
              <span className="assignment-modal__toggle-slider" />
              <span className="assignment-modal__toggle-label">
                🔁 Repetir Ronda Diariamente
              </span>
            </label>
          </div>

          {/* Recurring End Date */}
          {isRecurring && (
            <div className="assignment-modal__field">
              <label className="assignment-modal__label">Fecha de Fin de Repetición *</label>
              <div className="assignment-modal__datetime-wrapper">
                <FaCalendarAlt className="assignment-modal__datetime-icon" />
                <input
                  type="date"
                  className="assignment-modal__datetime-input"
                  value={recurringEndDate}
                  onChange={(e) => {
                    setRecurringEndDate(e.target.value)
                    setIsDirty(true)
                    const err = validateDate(form.scheduledStart)
                    setError(err)
                  }}
                  min={form.scheduledStart ? form.scheduledStart.split('T')[0] : ''}
                  required={isRecurring}
                />
              </div>
              <span className="assignment-modal__hint">
                Se creará una ronda diaria a la misma hora hasta la fecha seleccionada.
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="assignment-modal__actions">
            <button type="button" className="assignment-modal__btn assignment-modal__btn--cancel" onClick={handleClose}>
              Cancelar
            </button>
            <button type="submit" className="assignment-modal__btn assignment-modal__btn--submit" disabled={isSubmitting || !!error}>
              {isSubmitting ? 'Asignando...' : 'Asignar Ronda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
