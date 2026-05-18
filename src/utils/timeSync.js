let timeOffset = 0

export const syncTrueTime = async () => {
  try {
    const res = await fetch('https://worldtimeapi.org/api/timezone/America/La_Paz')
    if (!res.ok) return
    const data = await res.json()
    const realTime = new Date(data.datetime).getTime()
    timeOffset = realTime - Date.now()
    console.log('[TimeSync] Offset calculado:', timeOffset, 'ms')
  } catch (err) {
    console.warn('[TimeSync] Fallo al sincronizar hora real:', err)
  }
}

export const getTrueTime = () => Date.now() + timeOffset
