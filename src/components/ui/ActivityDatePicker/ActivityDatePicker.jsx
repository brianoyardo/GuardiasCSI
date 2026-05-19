import { useState, useMemo, useRef, useEffect } from 'react'
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'
import './ActivityDatePicker.css'

const DAY_NAMES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function formatDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

export default function ActivityDatePicker({ value, onChange, activeDates = new Set(), label }) {
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const d = new Date(value)
      return { year: d.getFullYear(), month: d.getMonth() }
    }
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const displayValue = useMemo(() => {
    if (!value) return 'Seleccionar...'
    const d = new Date(value)
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
  }, [value])

  const { year, month } = viewDate
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = new Date()
  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate())

  const calendarDays = useMemo(() => {
    const days = []
    for (let i = 0; i < firstDay; i++) {
      days.push(null)
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d)
    }
    return days
  }, [firstDay, daysInMonth])

  const prevMonth = () => {
    setViewDate(prev => {
      const newMonth = prev.month - 1
      if (newMonth < 0) return { year: prev.year - 1, month: 11 }
      return { ...prev, month: newMonth }
    })
  }

  const nextMonth = () => {
    setViewDate(prev => {
      const newMonth = prev.month + 1
      if (newMonth > 11) return { year: prev.year + 1, month: 0 }
      return { ...prev, month: newMonth }
    })
  }

  const selectDay = (day) => {
    if (!day) return
    const key = formatDateKey(year, month, day)
    onChange(key)
    setIsOpen(false)
  }

  return (
    <div className="activity-date-picker" ref={containerRef}>
      {label && <span className="activity-date-picker__label">{label}</span>}
      <button
        type="button"
        className={`activity-date-picker__trigger ${isOpen ? 'activity-date-picker__trigger--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {displayValue}
      </button>

      {isOpen && (
        <div className="activity-date-picker__popover">
          <div className="activity-date-picker__header">
            <button type="button" className="activity-date-picker__nav" onClick={prevMonth}>
              <FaChevronLeft />
            </button>
            <span className="activity-date-picker__month-label">
              {MONTH_NAMES[month]} {year}
            </span>
            <button type="button" className="activity-date-picker__nav" onClick={nextMonth}>
              <FaChevronRight />
            </button>
          </div>

          <div className="activity-date-picker__grid">
            {DAY_NAMES.map(d => (
              <div key={d} className="activity-date-picker__day-name">{d}</div>
            ))}
            {calendarDays.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="activity-date-picker__day" />
              const key = formatDateKey(year, month, day)
              const isToday = key === todayKey
              const isSelected = key === value
              const hasActivity = activeDates.has(key)

              return (
                <button
                  key={key}
                  type="button"
                  className={`activity-date-picker__day ${isToday ? 'activity-date-picker__day--today' : ''} ${isSelected ? 'activity-date-picker__day--selected' : ''}`}
                  onClick={() => selectDay(day)}
                >
                  <span className="activity-date-picker__day-number">{day}</span>
                  {hasActivity && <span className="activity-dot" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
