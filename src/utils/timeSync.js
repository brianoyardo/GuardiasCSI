let serverTime = 0
let localPerf = 0

export const syncTrueTime = async () => {
  try {
    const res = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=UTC')
    if (!res.ok) throw new Error('API no respondió correctamente')

    const data = await res.json()
    serverTime = new Date(data.dateTime + 'Z').getTime()
    localPerf = performance.now()

    console.log('[TimeSync] Reloj blindado sincronizado con éxito.')
  } catch (err) {
    console.warn('[TimeSync] Fallo la red, operando con reloj local.', err.message)
  }
}

export const getTrueTime = () => serverTime > 0 ? serverTime + (performance.now() - localPerf) : Date.now()
