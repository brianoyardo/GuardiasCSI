import { useState, useCallback } from 'react'
import { PATROL_TYPES, SHIFT_TYPES } from '@/config/constants'
import CustomSelect from '@/components/ui/CustomSelect/CustomSelect'
import './PreOpModal.css'

export default function PreOpModal({ rondaName, onConfirm, onCancel }) {
  const [patrolType, setPatrolType] = useState(PATROL_TYPES.A_PIE)
  const [vehicleId, setVehicleId] = useState('')
  const [shift, setShift] = useState(SHIFT_TYPES.DIURNO)
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isMotorized = patrolType === PATROL_TYPES.MOTORIZADO

  const handleConfirm = useCallback(() => {
    if (isSubmitting) return

    if (isMotorized && !vehicleId.trim()) {
      setError('Ingrese el identificador del vehículo')
      return
    }

    setError(null)
    setIsSubmitting(true)
    onConfirm({
      patrolType,
      vehicleId: isMotorized ? vehicleId.trim() : null,
      shift,
    })
  }, [patrolType, vehicleId, shift, isMotorized, onConfirm, isSubmitting])

  const patrolOptions = Object.entries(PATROL_TYPES).map(([key, value]) => ({
    value,
    label: key.replace('_', ' ').replace('A PIE', 'A Pie'),
  }))

  const shiftOptions = Object.entries(SHIFT_TYPES).map(([key, value]) => ({
    value,
    label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  }))

  return (
    <div className="preop-modal" id="preop-modal">
      <div className="preop-modal__overlay" />

      <div className="preop-modal__content">
        {/* Header */}
        <div className="preop-modal__header">
          <h2 className="preop-modal__title">Datos Operativos</h2>
          <p className="preop-modal__subtitle">{rondaName || 'Ronda de Patrullaje'}</p>
        </div>

        {/* Form */}
        <div className="preop-modal__form">
          {/* Patrol Type */}
          <div className="preop-modal__field">
            <label className="preop-modal__label">Tipo de Patrullaje *</label>
            <CustomSelect
              value={patrolType}
              onChange={(val) => {
                setPatrolType(val)
                setError(null)
              }}
              options={patrolOptions}
            />
          </div>

          {/* Vehicle ID (conditional) */}
          {isMotorized && (
            <div className="preop-modal__field preop-modal__field--highlight">
              <label className="preop-modal__label">Identificador del Vehículo *</label>
              <input
                className="preop-modal__input"
                type="text"
                placeholder="Ej: VEH-001, Moto-12"
                value={vehicleId}
                onChange={(e) => {
                  setVehicleId(e.target.value)
                  setError(null)
                }}
                autoFocus
              />
            </div>
          )}

          {/* Shift */}
          <div className="preop-modal__field">
            <label className="preop-modal__label">Turno *</label>
            <CustomSelect
              value={shift}
              onChange={setShift}
              options={shiftOptions}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="preop-modal__error">{error}</div>
          )}
        </div>

        {/* Actions */}
        <div className="preop-modal__actions">
          <button
            className="preop-modal__btn preop-modal__btn--cancel"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            className={`preop-modal__btn preop-modal__btn--confirm ${isSubmitting ? 'preop-modal__btn--submitting' : ''}`}
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Iniciando...' : 'Continuar →'}
          </button>
        </div>
      </div>
    </div>
  )
}
