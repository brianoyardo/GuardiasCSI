import { useState, useRef, useEffect } from 'react'
import './CustomSelect.css'

export default function CustomSelect({ value, onChange, options, placeholder = 'Seleccionar...' }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const selected = options.find(o => o.value === value)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (opt) => {
    onChange(opt.value)
    setIsOpen(false)
  }

  return (
    <div className="custom-select" ref={containerRef}>
      <div
        className={`custom-select__trigger ${isOpen ? 'custom-select__trigger--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setIsOpen(!isOpen)}
      >
        <span className="custom-select__value">
          {selected ? selected.label : placeholder}
        </span>
        <span className={`custom-select__arrow ${isOpen ? 'custom-select__arrow--open' : ''}`}>▼</span>
      </div>

      {isOpen && (
        <ul className="custom-select__dropdown">
          {options.map((opt) => (
            <li
              key={opt.value}
              className={`custom-select__option ${opt.value === value ? 'custom-select__option--selected' : ''}`}
              onClick={() => handleSelect(opt)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
