let serverTime = 0
let localPerf = 0

export const syncTrueTime = async () => {
  try {
    const res = await fetch('https://worldtimeapi.org/api/timezone/America/La_Paz')
    if (!res.ok) return
    const data = await res.json()
    serverTime = new Date(data.datetime).getTime()
    localPerf = performance.now()
    console.log('[TimeSync] Hora real de La Paz sincronizada')
  } catch (err) {
    console.warn('[TimeSync] Fallo al sincronizar hora real:', err)
  }
}

export const getTrueTime = () => serverTime > 0 ? serverTime + (performance.now() - localPerf) : Date.now()
