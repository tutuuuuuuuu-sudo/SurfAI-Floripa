// weatherApi.ts — proxy via /api/surf (Windy → Open-Meteo → Stormglass, server-side)
// Chaves de API nunca chegam ao browser.

export interface WindyForecastData {
  waveHeight: number
  swellPeriod: number
  swellDirection: string
  windSpeed: number
  windDirection: string
  waterTemperature?: number
  sunrise?: string
  sunset?: string
}

const cache: Record<string, { data: WindyForecastData; time: number }> = {}
const CACHE_DURATION = 15 * 60 * 1000

async function fetchWithRetry(url: string, maxAttempts = 3): Promise<Response | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (res.ok) return res
      if (res.status >= 400 && res.status < 500) return null // client error — don't retry
    } catch {
      // network error or timeout
    }
    if (attempt < maxAttempts - 1) {
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)))
    }
  }
  return null
}

export async function getWindyForecast(
  lat: number,
  lng: number,
  beachOrientation?: number
): Promise<WindyForecastData | null> {
  const cacheKey = `${lat.toFixed(3)}_${lng.toFixed(3)}`
  const now = Date.now()

  if (cache[cacheKey] && (now - cache[cacheKey].time) < CACHE_DURATION) {
    return cache[cacheKey].data
  }

  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
      orientation: (beachOrientation ?? 90).toString(),
    })
    const res = await fetchWithRetry(`/api/surf?${params}`)
    if (!res) return null

    const data = await res.json() as WindyForecastData & { error?: string }
    if (data.error) return null

    const result: WindyForecastData = {
      waveHeight: data.waveHeight,
      swellPeriod: data.swellPeriod,
      swellDirection: data.swellDirection,
      windSpeed: data.windSpeed,
      windDirection: data.windDirection,
      waterTemperature: data.waterTemperature ?? undefined,
      sunrise: data.sunrise,
      sunset: data.sunset,
    }

    cache[cacheKey] = { data: result, time: now }
    return result
  } catch {
    return null
  }
}

// ── Temperatura e maré real (via /api/tide — proxy serverless) ──

export async function getRealTide(): Promise<{
  level: number
  state: 'Enchendo' | 'Secando' | 'Cheia' | 'Vazia'
  hourlyLevels: number[]
} | null> {
  try {
    const res = await fetchWithRetry('/api/tide?type=tide')
    if (!res) return null
    const data = await res.json() as { heights?: number[]; times?: string[]; error?: string }
    if (data.error || !data.heights) return null

    const levels: number[] = data.heights
    const hour = new Date().getHours()
    const current = levels[hour] ?? 0
    const next = levels[Math.min(levels.length - 1, hour + 1)] ?? current

    let state: 'Enchendo' | 'Secando' | 'Cheia' | 'Vazia'
    if (next > current + 0.03) state = 'Enchendo'
    else if (next < current - 0.03) state = 'Secando'
    else if (current > 0.6) state = 'Cheia'
    else state = 'Vazia'

    return { level: Number(current.toFixed(2)), state, hourlyLevels: levels }
  } catch {
    return null
  }
}

export async function getRealWaterTemp(): Promise<number> {
  try {
    const res = await fetchWithRetry('/api/tide?type=temp')
    if (res) {
      const data = await res.json() as { temp?: number }
      if (typeof data.temp === 'number') return data.temp
    }
  } catch { /* fallback */ }

  // Fallback sazonal calibrado para Florianópolis
  return [25, 25, 24, 22, 21, 20, 19, 18, 19, 20, 22, 24][new Date().getMonth()]
}
