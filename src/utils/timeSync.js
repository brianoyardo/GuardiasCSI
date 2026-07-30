/**
 * SentinelOps — API Antifraude / Reloj Blindado
 *
 * Obtiene la hora real desde un servidor externo para evitar que un guardia
 * manipule el reloj de su dispositivo y fuerce el inicio de una ronda fuera
 * del horario asignado.
 *
 * ─── ZONA HORARIA ────────────────────────────────────────────────────────────
 * Se solicita la hora en America/La_Paz (UTC-4, Bolivia).
 * CRÍTICO: scheduledStart se guarda en Firestore como milisegundos epoch
 * generados por el navegador del administrador (también en UTC-4). Ambos
 * lados de la comparación deben usar la misma referencia temporal local
 * para que isTooEarly / isMissed funcionen correctamente.
 *
 * Si se usara UTC (timeZone=UTC), la API devolvería 4 horas más que la hora
 * local, produciendo una diferencia sistemática que bloquea el inicio de rondas.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TIME_API_URL = import.meta.env.VITE_TIME_API_URL ||
  'https://timeapi.io/api/Time/current/zone?timeZone=America%2FLa_Paz'

let serverTime = 0   // Timestamp local (ms) obtenido de la API en el momento de sincronización
let localPerf  = 0   // performance.now() en el momento de sincronización (ms desde carga de página)

export let isTimeSynced = false

/**
 * Sincroniza el reloj blindado con la API externa.
 * Debe llamarse una sola vez al cargar la vista de guardias (MisRondasPage).
 */
export const syncTrueTime = async () => {
  try {
    const res = await fetch(TIME_API_URL)
    if (!res.ok) throw new Error('API no respondió correctamente')

    const data = await res.json()

    // La API retorna dateTime en hora local de Bolivia (America/La_Paz, UTC-4).
    // Al parsear SIN sufijo 'Z', el motor JS de Date lo interpreta como hora local
    // del cliente, que también está en UTC-4 → los milisegundos epoch son coherentes
    // con los timestamps generados por el admin form (datetime-local input).
    serverTime = new Date(data.dateTime).getTime()
    localPerf  = performance.now()
    isTimeSynced = true

    // console.log('[TimeSync] ✅ Reloj blindado sincronizado con éxito. Hora BO:', data.dateTime)
  } catch (err) {
    isTimeSynced = false
    // console.warn('[TimeSync] ⚠ Falló la sincronización, operando con reloj local.', err.message)
  }
}

/**
 * Retorna el timestamp actual estimado (ms) basado en el reloj sincronizado.
 * Si la sincronización falló, cae de vuelta al reloj local del dispositivo.
 *
 * @returns {number} Milisegundos epoch en hora local (Bolivia UTC-4)
 */
export const getTrueTime = () =>
  serverTime > 0
    ? serverTime + (performance.now() - localPerf)
    : Date.now()
