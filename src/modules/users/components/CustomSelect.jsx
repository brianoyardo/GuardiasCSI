import { useState, useEffect, useRef } from 'react'
import './CustomSelect.css'

/**
 * Premium CustomSelect Component
 * Replaces native HTML selects with a gorgeous, high-fidelity dark glassmorphic selection menu.
 */
export default function CustomSelect({ value, onChange, options, disabled = false, className = '' }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const selectedOption = options.find(opt => opt.value === value)

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  return (
    <div 
      className={`cs-container ${disabled ? 'cs-container--disabled' : ''} ${className}`} 
      ref={containerRef}
    >
      <button
        type="button"
        className={`cs-trigger ${isOpen ? 'cs-trigger--open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className="cs-trigger-label">{selectedOption ? selectedOption.label : 'Seleccionar...'}</span>
        <span className="cs-trigger-arrow">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
      </button>

      {isOpen && (
        <ul className="cs-options">
          {options.map(opt => (
            <li
              key={opt.value}
              className={`cs-option ${opt.value === value ? 'cs-option--selected' : ''}`}
              onClick={() => {
                onChange(opt.value)
                setIsOpen(false)
              }}
            >
              <span className="cs-option-text">{opt.label}</span>
              {opt.value === value && (
                <span className="cs-option-check">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
