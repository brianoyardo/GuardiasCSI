import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './CustomTimePicker.css'

/**
 * Premium CustomTimePicker Component
 * Replaces native time inputs with a gorgeous glassmorphic 24h hour/minute picker.
 * Renders via React Portal to prevent clipping in scroll containers.
 * 
 * @param {string} value - Selected time in "HH:MM" format (or null/empty)
 * @param {Function} onChange - Callback receiving "HH:MM"
 * @param {boolean} disabled - Whether the picker is interactive
 * @param {string} placeholder - Display text when value is null/empty
 */
export default function CustomTimePicker({ value, onChange, disabled = false, placeholder = '00:00' }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const hoursRef = useRef(null)
  const minutesRef = useRef(null)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 200 })

  // Parse current value
  let currentHour = '08'
  let currentMinute = '00'
  if (value && value.includes(':')) {
    const parts = value.split(':')
    currentHour = parts[0].padStart(2, '0')
    currentMinute = parts[1].padStart(2, '0')
  }

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const dropdownHeight = 250 // Approximate height of the dropdown
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top

      const shouldOpenUpward = spaceBelow < dropdownHeight && spaceAbove > spaceBelow

      setCoords({
        top: shouldOpenUpward
          ? rect.top + window.scrollY - dropdownHeight - 6
          : rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      })
    }
  }

  useEffect(() => {
    if (isOpen) {
      updateCoords()
      window.addEventListener('resize', updateCoords)
      window.addEventListener('scroll', updateCoords, true)
    }
    return () => {
      window.removeEventListener('resize', updateCoords)
      window.removeEventListener('scroll', updateCoords, true)
    }
  }, [isOpen])

  useEffect(() => {
    const handleOutsideClick = (e) => {
      const portalEl = document.getElementById('ctp-portal-dropdown')
      if (
        containerRef.current && !containerRef.current.contains(e.target) &&
        (!portalEl || !portalEl.contains(e.target))
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // Scroll active elements into view when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (hoursRef.current) {
          const selectedHourEl = hoursRef.current.querySelector('.ctp-column-item--selected')
          if (selectedHourEl) {
            hoursRef.current.scrollTop = selectedHourEl.offsetTop - hoursRef.current.clientHeight / 2 + selectedHourEl.clientHeight / 2
          }
        }
        if (minutesRef.current) {
          const selectedMinEl = minutesRef.current.querySelector('.ctp-column-item--selected')
          if (selectedMinEl) {
            minutesRef.current.scrollTop = selectedMinEl.offsetTop - minutesRef.current.clientHeight / 2 + selectedMinEl.clientHeight / 2
          }
        }
      }, 60)
    }
  }, [isOpen, currentHour, currentMinute])

  const handleSelectHour = (h) => {
    onChange(`${h}:${currentMinute}`)
  }

  const handleSelectMinute = (m) => {
    onChange(`${currentHour}:${m}`)
  }

  return (
    <div 
      className={`ctp-container ${disabled ? 'ctp-container--disabled' : ''}`} 
      ref={containerRef}
    >
      <button
        type="button"
        ref={triggerRef}
        className={`ctp-trigger ${isOpen ? 'ctp-trigger--open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className="ctp-trigger-icon">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </span>
        <span className="ctp-trigger-label">{value || placeholder}</span>
      </button>

      {isOpen && createPortal(
        <div 
          id="ctp-portal-dropdown"
          className="ctp-dropdown animate-fade-in-up"
          style={{
            position: 'absolute',
            top: `${coords.top + 6}px`,
            left: `${coords.left}px`,
            width: `${Math.max(coords.width, 200)}px`,
            zIndex: 30000
          }}
        >
          <div className="ctp-dropdown-header">
            <span>Hora</span>
            <span>Minuto</span>
          </div>
          
          <div className="ctp-dropdown-columns">
            {/* Hours Column */}
            <div className="ctp-column" ref={hoursRef}>
              {hours.map(h => (
                <button
                  key={h}
                  type="button"
                  className={`ctp-column-item ${h === currentHour ? 'ctp-column-item--selected' : ''}`}
                  onClick={() => handleSelectHour(h)}
                >
                  {h}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="ctp-divider">:</div>

            {/* Minutes Column */}
            <div className="ctp-column" ref={minutesRef}>
              {minutes.map(m => (
                <button
                  key={m}
                  type="button"
                  className={`ctp-column-item ${m === currentMinute ? 'ctp-column-item--selected' : ''}`}
                  onClick={() => handleSelectMinute(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="ctp-dropdown-footer">
            <button 
              type="button" 
              className="ctp-confirm-btn"
              onClick={() => setIsOpen(false)}
            >
              Listo
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
