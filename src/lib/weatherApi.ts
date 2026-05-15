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
    const res = await fetch(`/api/surf?${params}`)
    if (!res.ok) return null

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

// ── Temperatura e maré real (Open-Meteo direto — sem chave, dados públicos) ──

export async function getRealTide(): Promise<{
  level: number
  state: 'Enchendo' | 'Secando' | 'Cheia' | 'Vazia'
  hourlyLevels: number[]
} | null> {
  try {
    const res = await fetch(
      'https://marine-api.open-meteo.com/v1/marine?latitude=-27.62&longitude=-48.48&hourly=sea_level_height_msl&timezone=America%2FSao_Paulo&forecast_days=1'
    )
    const data = await res.json() as any
    if (data.error || !data.hourly?.sea_level_height_msl) return null

    const levels: number[] = data.hourly.sea_level_height_msl
    const hour = new Date().getHours()
    const current = levels[hour] ?? 0
    const next = levels[Math.min(23, hour + 1)] ?? current

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
  // Fonte 1: NOAA ERDDAP — SST satélite
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const url = `https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplMURSST41.json?analysed_sst[${yesterday}T09:00:00Z][(-27.62)][(-48.48)]`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const data = await res.json() as any
      const sst = data?.table?.rows?.[0]?.[3]
      if (typeof sst === 'number' && sst >= 15 && sst <= 27) return Math.round(sst)
    }
  } catch { /* tenta próxima */ }

  // Fonte 2: Open-Meteo Marine
  try {
    const res = await fetch(
      'https://marine-api.open-meteo.com/v1/marine?latitude=-27.62&longitude=-48.48&current=sea_surface_temperature&models=meteofrance_wave',
      { signal: AbortSignal.timeout(5000) }
    )
    const data = await res.json() as any
    const sst = data.current?.sea_surface_temperature
    if (sst != null && sst >= 15 && sst <= 27) return Math.round(sst)
  } catch { /* fallback */ }

  // Fonte 3: Fallback sazonal calibrado para Florianópolis
  return [25, 25, 24, 22, 21, 20, 19, 18, 19, 20, 22, 24][new Date().getMonth()]
}
