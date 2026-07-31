/**
 * SentinelOps — API Antifraude / Reloj Blindado
 *
 * Obtiene la hora verdadera desde servidores externos para impedir que un guardia
 * manipule el reloj de su dispositivo y fuerce el inicio de una ronda fuera
 * del horario asignado.
 *
 * ─── ESTRATEGIA MULTI-FUENTE (en orden de prioridad) ─────────────────────────
 *  1. Cloudflare CDN  — campo `ts` de /cdn-cgi/trace  (primario)
 *  2. timeapi.io      — API HTTP pública              (fallback)
 *  3. Date.now()      — Reloj local del dispositivo   (último recurso)
 *
 * ─── POR QUÉ CLOUDFLARE ES PRIMARIO ──────────────────────────────────────────
 *  • +300 PoPs distribuidos globalmente — latencia < 20ms desde Bolivia
 *  • Respuesta siempre fresca, sin caché de CDN en la ruta de trace
 *  • El campo `ts` es Unix timestamp UTC en segundos con décimas de ms
 *  • Sin API key, sin límite de requests, infraestructura de nivel Fortune 500
 *
 * ─── COMPENSACIÓN DE LATENCIA (estilo NTP) ───────────────────────────────────
 *  Se mide el RTT de cada petición. El timestamp del servidor representa el
 *  momento de generación de la respuesta, por lo que se le suma RTT/2 para
 *  obtener el instante actual con precisión < 50ms en condiciones normales.
 *
 *  Fórmula: serverTime = ts_servidor + RTT/2
 *
 * ─── EPOCH MS — INVARIANTE DE ZONA HORARIA ───────────────────────────────────
 *  serverTime se almacena en UTC epoch ms. scheduledStart también es UTC epoch ms
 *  (generado por el admin via new Date(datetime-local).getTime(), que internamente
 *  es UTC epoch sin importar el timezone del navegador). La comparación en
 *  RondaCard.jsx es epoch vs epoch → completamente timezone-agnostic.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Constantes de configuración ─────────────────────────────────────────────
const CLOUDFLARE_TRACE_URL = 'https://1.1.1.1/cdn-cgi/trace'
const TIMEAPI_URL          = 'https://timeapi.io/api/Time/current/zone?timeZone=UTC'
const FETCH_TIMEOUT_MS     = 5000  // Máximo ms de espera por fuente antes de pasar al fallback

// ─── Estado del módulo ────────────────────────────────────────────────────────
let serverTime = 0   // UTC epoch ms capturado del servidor en la última sincronización
let localPerf  = 0   // performance.now() en el instante de la sincronización

export let isTimeSynced = false

// ─── Utilidad: fetch con timeout ──────────────────────────────────────────────
const fetchWithTimeout = (url, timeoutMs = FETCH_TIMEOUT_MS) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer))
}

// ─── FUENTE 1: Cloudflare CDN ─────────────────────────────────────────────────
/**
 * Parsea el campo `ts` del endpoint /cdn-cgi/trace de Cloudflare.
 * Ejemplo de respuesta: "ts=1785455990.123"
 * Aplica compensación NTP (RTT/2) para mayor precisión.
 */
const syncFromCloudflare = async () => {
  const t1  = performance.now()
  const res = await fetchWithTimeout(CLOUDFLARE_TRACE_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const t2   = performance.now()
  const text = await res.text()

  const match = text.match(/ts=(\d+\.?\d*)/)
  if (!match) throw new Error('Campo ts no encontrado en Cloudflare trace')

  const rtt         = t2 - t1                    // Round-trip time en ms
  const serverUtcMs = parseFloat(match[1]) * 1000 // Convertir segundos → ms

  // Compensación NTP: ts fue generado al inicio de la respuesta,
  // sumamos RTT/2 para estimar el instante actual.
  serverTime = serverUtcMs + rtt / 2
  localPerf  = t2

  // console.log(`[TimeSync] ✅ Cloudflare OK | RTT: ${rtt.toFixed(0)}ms | ${new Date(serverTime).toISOString()}`)
}

// ─── FUENTE 2: timeapi.io (Fallback) ─────────────────────────────────────────
/**
 * Usa el endpoint de timeapi.io en zona UTC.
 * Aplica compensación NTP y sufijo 'Z' para parseo explícito como UTC.
 */
const syncFromTimeApi = async () => {
  const t1  = performance.now()
  const res = await fetchWithTimeout(TIMEAPI_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const t2   = performance.now()
  const data = await res.json()

  if (!data.dateTime) throw new Error('Campo dateTime no encontrado en respuesta')

  const rtt         = t2 - t1
  // dateTime viene en UTC — el sufijo 'Z' fuerza parseo explícito como UTC
  const serverUtcMs = new Date(data.dateTime + 'Z').getTime()

  serverTime = serverUtcMs + rtt / 2
  localPerf  = t2

  // console.log(`[TimeSync] ✅ timeapi.io OK (fallback) | RTT: ${rtt.toFixed(0)}ms | ${new Date(serverTime).toISOString()}`)
}

// ─── API Pública ──────────────────────────────────────────────────────────────

/**
 * Sincroniza el reloj blindado intentando las fuentes en orden de confiabilidad.
 * Debe llamarse UNA VEZ al montar la vista de guardias (MisRondasPage).
 *
 * Cadena de fallback:
 *   Cloudflare → timeapi.io → [isTimeSynced = false, usa Date.now()]
 */
export const syncTrueTime = async () => {
  // Intento 1: Cloudflare (primario)
  try {
    await syncFromCloudflare()
    isTimeSynced = true
    return
  } catch (err) {
    // console.warn('[TimeSync] ⚠ Cloudflare no disponible, intentando fallback...', err.message)
  }

  // Intento 2: timeapi.io (fallback)
  try {
    await syncFromTimeApi()
    isTimeSynced = true
    return
  } catch (err) {
    // console.warn('[TimeSync] ⚠ timeapi.io tampoco respondió. Operando con reloj local.', err.message)
  }

  // Sin sincronización exitosa
  isTimeSynced = false
}

/**
 * Retorna el timestamp actual estimado en UTC epoch ms.
 *
 * Si el reloj está sincronizado, computa el tiempo transcurrido desde la
 * última sincronización usando performance.now() (monotónico, no manipulable).
 * Si ninguna fuente respondió, cae de vuelta a Date.now() del dispositivo.
 *
 * @returns {number} UTC epoch ms
 */
export const getTrueTime = () =>
  serverTime > 0
    ? serverTime + (performance.now() - localPerf)
    : Date.now()
