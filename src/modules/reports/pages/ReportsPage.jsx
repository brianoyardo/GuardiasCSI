import { useState, useCallback } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/config/firebase'
import * as XLSX from 'xlsx'
import './ReportsPage.css'

export default function ReportsPage() {
  const [loading, setLoading] = useState(false)
  const [activeExport, setActiveExport] = useState(null) // ID of current exporting collection
  const [successMsg, setSuccessMsg] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)

  // Format timestamp helper
  const formatTime = (ts) => {
    if (!ts) return '—'
    const dateObj = ts.toMillis ? new Date(ts.toMillis()) : new Date(ts)
    return dateObj.toLocaleString('es-BO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  // Fetch helper
  const getCollectionDocs = async (colName) => {
    const colRef = collection(db, colName)
    const snap = await getDocs(colRef)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }

  // Individual Formatter Mappers
  const mappers = {
    users: (docs) => docs.map(d => ({
      'ID de Usuario': d.id,
      'Nombre Completo': d.fullName || '—',
      'Correo Electrónico': d.email || '—',
      'Rol asignado': d.role || '—',
      'Estado de Cuenta': d.status || '—',
      'ID Guardia CSI': d.guardId || '—',
      'Número Telefónico': d.phone || '—',
      'Horario Inicio Turno': d.shiftStart || '—',
      'Horario Fin Turno': d.shiftEnd || '—',
      'Último Inicio de Sesión': d.lastLogin ? formatTime(d.lastLogin) : '—',
      'Fecha Creación Perfil': d.createdAt ? formatTime(d.createdAt) : '—'
    })),
    rondaAssignments: (docs) => docs.map(d => ({
      'ID Asignación': d.id,
      'ID de Guardia': d.guardId || '—',
      'Nombre del Guardia': d.guardName || '—',
      'ID de Ruta': d.routeId || '—',
      'Nombre de la Ruta': d.routeName || '—',
      'ID Geocerca': d.geofenceId || '—',
      'Estado Asignación': d.status || '—',
      'Fecha Programada': d.date || '—',
      'Asignado en Fecha': d.createdAt ? formatTime(d.createdAt) : '—'
    })),
    rondaExecutions: (docs) => docs.map(d => ({
      'ID Ejecución': d.id,
      'ID Asignación Ronda': d.assignmentId || '—',
      'ID del Guardia': d.guardId || '—',
      'Nombre del Guardia': d.guardName || '—',
      'ID de Ruta': d.routeId || '—',
      'Nombre de la Ruta': d.routeName || '—',
      'Estado Ronda': d.status || '—',
      'Fecha/Hora Inicio': d.startedAt ? formatTime(d.startedAt) : '—',
      'Fecha/Hora Fin': d.endedAt ? formatTime(d.endedAt) : '—',
      'Duración (Segundos)': d.durationSeconds || 0,
      'Checkpoints Visitados': Array.isArray(d.completedCheckpoints) ? d.completedCheckpoints.join(', ') : '—',
      'Total Checkpoints': d.totalCheckpoints || 0,
      'Puntaje Calificación': d.score !== undefined ? `${d.score} / 100` : '—'
    })),
    incidents: (docs) => docs.map(d => ({
      'ID de Incidente': d.id,
      'ID Guardia Reportante': d.reporterId || '—',
      'Nombre Guardia Reportante': d.reporterName || '—',
      'Título Incidente': d.title || '—',
      'Descripción Reportada': d.description || '—',
      'Gravedad Severidad': d.severity || '—',
      'Estado Reporte': d.status || '—',
      'ID de Ruta': d.routeId || '—',
      'Nombre de Ruta': d.routeName || '—',
      'ID Geocerca Asignada': d.geofenceId || '—',
      'Reportado en Fecha': d.createdAt ? formatTime(d.createdAt) : '—',
      'URL Evidencia (AppWrite)': d.evidenceUrl || '—'
    })),
    personalAttendance: (docs) => docs.map(d => ({
      'ID Asistencia': d.id,
      'ID de Usuario': d.uid || '—',
      'Correo Guardia': d.email || '—',
      'Fecha Asistencia': d.date || '—',
      'Hora Marcado Entrada': d.clockIn || '—',
      'Coordenada Entrada (Latitud)': d.clockInCoords?.lat || '—',
      'Coordenada Entrada (Longitud)': d.clockInCoords?.lng || '—',
      'Dispositivo': d.deviceName || '—'
    })),
    guardPresence: (docs) => docs.map(d => ({
      'ID Presencia': d.id,
      'ID del Guardia': d.guardId || '—',
      'Nombre Completo': d.guardName || '—',
      'Código Guardia': d.guardCode || '—',
      'Estado Presencia': d.status || '—',
      'Última Transmisión GPS': d.lastUpdate ? formatTime(d.lastUpdate) : '—',
      'Última Latitud GPS': d.location?.lat || '—',
      'Última Longitud GPS': d.location?.lng || '—'
    }))
  }

  // Trigger export for one single collection
  const handleExportSingle = useCallback(async (key, colName, label) => {
    if (loading) return
    setLoading(true)
    setActiveExport(key)
    setSuccessMsg(null)
    setErrorMsg(null)

    try {
      const docs = await getCollectionDocs(colName)
      if (!docs.length) {
        throw new Error(`La colección de ${label} está vacía.`)
      }

      const formatted = mappers[key](docs)
      const worksheet = XLSX.utils.json_to_sheet(formatted)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, label)

      const stamp = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(workbook, `Reporte_${label.replace(/\s+/g, '_')}_${stamp}.xlsx`)
      
      setSuccessMsg(`¡Reporte de ${label} exportado con éxito!`)
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || 'Error al exportar los datos')
      setTimeout(() => setErrorMsg(null), 5000)
    } finally {
      setLoading(false)
      setActiveExport(null)
    }
  }, [loading])

  // Trigger multi-sheet workbook generation
  const handleExportAll = useCallback(async () => {
    if (loading) return
    setLoading(true)
    setActiveExport('all')
    setSuccessMsg(null)
    setErrorMsg(null)

    try {
      const collectionsToFetch = [
        { key: 'users', dbName: 'users', label: 'Usuarios' },
        { key: 'rondaAssignments', dbName: 'rondaAssignments', label: 'Asignaciones de Rondas' },
        { key: 'rondaExecutions', dbName: 'rondaExecutions', label: 'Historial Ejecuciones' },
        { key: 'incidents', dbName: 'incidents', label: 'Incidentes Reportados' },
        { key: 'personalAttendance', dbName: 'personalAttendance', label: 'Asistencia y Ingresos' },
        { key: 'guardPresence', dbName: 'guardPresence', label: 'Presencia GPS Guardia' }
      ]

      const workbook = XLSX.utils.book_new()
      let hasData = false

      for (const item of collectionsToFetch) {
        try {
          const docs = await getCollectionDocs(item.dbName)
          if (docs.length > 0) {
            const formatted = mappers[item.key](docs)
            const worksheet = XLSX.utils.json_to_sheet(formatted)
            XLSX.utils.book_append_sheet(workbook, worksheet, item.label.slice(0, 30)) // Sheet names limited to 31 chars
            hasData = true
          }
        } catch (colErr) {
          console.warn(`Error reading collection ${item.dbName}:`, colErr)
        }
      }

      if (!hasData) {
        throw new Error('No se encontraron registros de datos en ninguna colección de SentinelOps.')
      }

      const stamp = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(workbook, `Reporte_SentinelOps_General_${stamp}.xlsx`)

      setSuccessMsg('¡Libro Multihaja exportado con éxito!')
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || 'Error al compilar el reporte general.')
      setTimeout(() => setErrorMsg(null), 5000)
    } finally {
      setLoading(false)
      setActiveExport(null)
    }
  }, [loading])

  const reportCards = [
    {
      key: 'users',
      dbName: 'users',
      label: 'Usuarios y Personal',
      icon: '👥',
      description: 'Listado completo de guardias, supervisores y administradores, incluyendo roles, estado de cuenta y turnos asignados.'
    },
    {
      key: 'rondaAssignments',
      dbName: 'rondaAssignments',
      label: 'Programación de Rondas',
      icon: '📅',
      description: 'Detalle de las rondas de patrullaje asignadas a los guardias, rutas asociadas, geocercas y sus fechas correspondientes.'
    },
    {
      key: 'rondaExecutions',
      dbName: 'rondaExecutions',
      label: 'Historial de Patrullaje',
      icon: '🔄',
      description: 'Registro de rondas reproducidas, checkpoints marcados, tiempos de ejecución y calificaciones obtenidas.'
    },
    {
      key: 'incidents',
      dbName: 'incidents',
      label: 'Incidentes y Reportes',
      icon: '🚨',
      description: 'Tickets de incidentes reportados por guardias en patrulla con descripciones, severidad y links de evidencia adjunta.'
    },
    {
      key: 'personalAttendance',
      dbName: 'personalAttendance',
      label: 'Asistencia de Guardias',
      icon: '⏰',
      description: 'Historial de Clock-In (control de ingreso biométrico manual) con fecha, hora exacta, coordenadas GPS y tipo de dispositivo.'
    },
    {
      key: 'guardPresence',
      dbName: 'guardPresence',
      label: 'Geolocalización en Vivo',
      icon: '📍',
      description: 'Última posición GPS de guardias, estado de conectividad en tiempo real (online/offline) y timestamp de transmisión.'
    }
  ]

  return (
    <div className="reports-page" id="reports-page">
      {/* Page Header */}
      <div className="reports-page__header">
        <div>
          <h1 className="reports-page__title">Módulo de Reportes</h1>
          <p className="reports-page__subtitle">Exportación directa a hojas de cálculo Excel desde el repositorio de datos de SentinelOps</p>
        </div>
        <button
          className="reports-page__btn-all"
          disabled={loading}
          onClick={handleExportAll}
        >
          {activeExport === 'all' ? (
            <span className="reports-spinner-wrapper">
              <span className="reports-spinner" /> Generando Libro General...
            </span>
          ) : (
            <>📥 Exportar Todo (Libro Multihaja)</>
          )}
        </button>
      </div>

      {/* Messages */}
      {successMsg && <div className="reports-page__banner reports-page__banner--success">{successMsg}</div>}
      {errorMsg && <div className="reports-page__banner reports-page__banner--error">{errorMsg}</div>}

      {/* Cards Grid */}
      <div className="reports-page__grid">
        {reportCards.map((card) => {
          const isCurrent = activeExport === card.key
          return (
            <div key={card.key} className="reports-card">
              <div className="reports-card__icon">{card.icon}</div>
              <h2 className="reports-card__title">{card.label}</h2>
              <p className="reports-card__description">{card.description}</p>
              <div className="reports-card__footer">
                <span className="reports-card__db">Colección: {card.dbName}</span>
                <button
                  className="reports-card__btn"
                  disabled={loading}
                  onClick={() => handleExportSingle(card.key, card.dbName, card.label)}
                >
                  {isCurrent ? (
                    <span className="reports-spinner" />
                  ) : (
                    <>📥 Exportar Excel</>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
