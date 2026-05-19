import { useState, useCallback, useRef, useEffect } from 'react'
import { FaCalendarAlt } from 'react-icons/fa'
import CustomSelect from '@/components/ui/CustomSelect/CustomSelect'
import ConfirmModal from '@/components/ui/ConfirmModal/ConfirmModal'
import './RondaAssignmentModal.css'

export default function RondaAssignmentModal({ guards, routes, existingAssignments = [], onSubmit, onClose }) {
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
  const [showConfirmClose, setShowConfirmClose] = useState(false)
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

  const tzoffset = (new Date()).getTimezoneOffset() * 60000
  const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16)
  const localISODate = localISOTime.split('T')[0]

  const requestClose = useCallback(() => {
    if (isDirty) {
      setShowConfirmClose(true)
    } else {
      onClose()
    }
  }, [isDirty, onClose])

  const confirmClose = useCallback(() => {
    setShowConfirmClose(false)
    onClose()
  }, [onClose])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        requestClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [requestClose])

  const validateStartDate = (value) => {
    if (!value) return 'Fecha y hora requerida'
    const selectedTime = new Date(value).getTime()
    if (selectedTime <= Date.now()) {
      return 'La hora programada debe ser mayor a la hora actual'
    }
    return null
  }

  const validateRecurringEnd = () => {
    if (isRecurring && !recurringEndDate) {
      return 'Selecciona una fecha de fin para la repetición'
    }
    if (isRecurring && recurringEndDate && form.scheduledStart) {
      const startDay = form.scheduledStart.split('T')[0]
      if (recurringEndDate < startDay) {
        return 'La fecha de fin debe ser igual o posterior a la fecha de inicio'
      }
    }
    return null
  }

  const checkCollision = (guardId, startTs) => {
    const margin = 90 * 60 * 1000
    return existingAssignments.some(a =>
      a.guardId === guardId &&
      !['cancelled', 'missed', 'failed', 'completed'].includes(a.status) &&
      Math.abs(a.scheduledStart - startTs) < margin
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const startError = validateStartDate(form.scheduledStart)
    if (startError) {
      setError(startError)
      return
    }

    const endError = validateRecurringEnd()
    if (endError) {
      setError(endError)
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
        const [year, month, day] = recurringEndDate.split('-')
        const endDateObj = new Date(year, month - 1, day, 23, 59, 59, 999)
        const endTs = endDateObj.getTime()
        const oneDay = 24 * 60 * 60 * 1000
        const assignmentsToCreate = []

        for (let currentTs = startTs; currentTs <= endTs; currentTs += oneDay) {
          if (checkCollision(form.guardId, currentTs)) {
            setError('⚠️ El guardia ya tiene una ronda activa o programada en este horario (margen de 90 min).')
            setIsSubmitting(false)
            return
          }
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

        if (checkCollision(form.guardId, startTs)) {
          setError('⚠️ El guardia ya tiene una ronda activa o programada en este horario (margen de 90 min).')
          setIsSubmitting(false)
          return
        }

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
      const err = validateStartDate(value)
      setError(err)
    }
  }

  return (
    <div className="assignment-modal-overlay" id="assignment-modal">
      <div className="assignment-modal" ref={modalRef}>
        {/* Header */}
        <div className="assignment-modal__header">
          <h2 className="assignment-modal__title">Asignar Nueva Ronda</h2>
          <button className="assignment-modal__close" onClick={requestClose} aria-label="Cerrar">✕</button>
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
                min={localISOTime}
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
                  }}
                  min={form.scheduledStart ? form.scheduledStart.split('T')[0] : localISODate}
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
            <button type="button" className="assignment-modal__btn assignment-modal__btn--cancel" onClick={requestClose}>
              Cancelar
            </button>
            <button type="submit" className="assignment-modal__btn assignment-modal__btn--submit" disabled={isSubmitting || !!error}>
              {isSubmitting ? 'Asignando...' : 'Asignar Ronda'}
            </button>
          </div>
        </form>
      </div>

      {showConfirmClose && (
        <ConfirmModal
          title="Cambios sin guardar"
          message="Tienes cambios sin guardar. ¿Seguro que quieres cerrar?"
          onConfirm={confirmClose}
          onCancel={() => setShowConfirmClose(false)}
          confirmText="Cerrar"
          cancelText="Seguir editando"
        />
      )}
    </div>
  )
}
