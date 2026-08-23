export const config = { runtime: 'edge' }

import { applyDirectionalExposure } from './_scoreEngine.js'
import { createRateLimiter } from './_httpUtils.js'

// ── Utilitários ───────────────────────────────────────────────────────────────

const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

function degToDir(deg: number): string {
  return DIRS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]
}

function formatTimeBrasilia(isoString: string): string {
  const timePart = isoString.split('T')[1]
  return timePart ? timePart.substring(0, 5) : ''
}

function isValidCoord(lat: string | null, lng: string | null): boolean {
  if (!lat || !lng) return false
  const latN = parseFloat(lat), lngN = parseFloat(lng)
  return !isNaN(latN) && !isNaN(lngN) && latN >= -90 && latN <= 90 && lngN >= -180 && lngN <= 180
}

// Índice do timestamp UNIX (ms) mais próximo do momento atual
function nearestTsIndex(ts: number[]): number {
  const nowMs = Date.now()
  let best = 0, bestDiff = Infinity
  ts.forEach((t, i) => {
    const diff = Math.abs((t > 1e11 ? t : t * 1000) - nowMs)
    if (diff < bestDiff) { bestDiff = diff; best = i }
  })
  return best
}

// ── Fonte 0: Windy Point Forecast API (server-side — chave segura) ────────────

interface ForecastResult {
  waveHeight: number
  swellPeriod: number
  swellDirection: string
  windSpeed: number
  windDir: string
  waterTemperature: number | null
  sunrise?: string
  sunset?: string
}

async function fetchWindy(lat: string, lng: string): Promise<ForecastResult | null> {
  const key = process.env.WINDY_API_KEY
  if (!key) return null

  const endpoint = 'https://api.windy.com/api/point-forecast/v2'
  try {
    const [waveRes, windRes] = await Promise.all([
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: parseFloat(lat), lon: parseFloat(lng), model: 'gfsWave', parameters: ['windWaves', 'swell1'], key }),
      }),
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: parseFloat(lat), lon: parseFloat(lng), model: 'gfs', parameters: ['wind', 'temp'], levels: ['surface'], key }),
      }),
    ])
    if (!waveRes.ok || !windRes.ok) return null

    const waveData = await waveRes.json() as Record<string, unknown>
    const windData = await windRes.json() as Record<string, unknown>
    if ('error' in waveData || 'error' in windData) return null

    const ts = (waveData.ts ?? windData.ts) as number[] | undefined
    if (!ts?.length) return null

    const wi = nearestTsIndex(ts)
    const windTs = (windData.ts ?? ts) as number[]
    const wIdx = nearestTsIndex(windTs)

    const wH = ((waveData['windWaves_height-surface'] as number[])?.[wi] ?? 0)
    const sH = ((waveData['swell1_height-surface'] as number[])?.[wi] ?? 0)
    const sP = ((waveData['swell1_period-surface'] as number[])?.[wi] ?? 8)
    const sD = ((waveData['swell1_direction-surface'] as number[])?.[wi] ?? 90)

    const finalH = Math.max(wH, sH)
    if (finalH < 0.05) return null

    const wu = ((windData['wind_u-surface'] as number[])?.[wIdx] ?? 0)
    const wv = ((windData['wind_v-surface'] as number[])?.[wIdx] ?? 0)
    const windSpeedKmh = Math.round(Math.sqrt(wu * wu + wv * wv) * 3.6)
    const windDirDeg = (Math.atan2(-wu, -wv) * 180 / Math.PI + 360) % 360

    const tempK = (windData['temp-surface'] as number[])?.[wIdx]
    const waterTemperature = tempK != null ? Math.round(tempK - 273.15) : null

    return {
      waveHeight: Number(finalH.toFixed(1)),
      swellPeriod: Math.round(sP),
      swellDirection: degToDir(sD),
      windSpeed: windSpeedKmh,
      windDir: degToDir(windDirDeg),
      waterTemperature,
    }
  } catch {
    return null
  }
}

// ── Fonte 1: Open-Meteo (gratuito, sem chave) ─────────────────────────────────

async function fetchOpenMeteo(lat: string, lng: string): Promise<ForecastResult | null> {
  try {
    const [marineRes, weatherRes] = await Promise.all([
      fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&current=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction,sea_surface_temperature&length_unit=metric`),
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=wind_speed_10m,wind_direction_10m&daily=sunrise,sunset&wind_speed_unit=kmh&timezone=America%2FSao_Paulo`),
    ])
    if (!marineRes.ok || !weatherRes.ok) return null

    interface OpenMeteoMarine { error?: string; current?: { swell_wave_height?: number; swell_wave_period?: number; swell_wave_direction?: number; wave_height?: number; wave_period?: number; wave_direction?: number; sea_surface_temperature?: number } }
    interface OpenMeteoWeather { error?: string; current?: { wind_speed_10m?: number; wind_direction_10m?: number }; daily?: { sunrise?: string[]; sunset?: string[] } }
    const marine = await marineRes.json() as OpenMeteoMarine
    const weather = await weatherRes.json() as OpenMeteoWeather
    if (marine.error || weather.error) return null

    const waveHeight = Number((marine.current?.swell_wave_height ?? marine.current?.wave_height ?? 0).toFixed(1))
    if (waveHeight < 0.1 || Number.isNaN(waveHeight)) return null

    return {
      waveHeight,
      swellPeriod: Math.round(marine.current?.swell_wave_period ?? marine.current?.wave_period ?? 8),
      swellDirection: degToDir(marine.current?.swell_wave_direction ?? marine.current?.wave_direction ?? 180),
      windSpeed: Math.round(weather.current?.wind_speed_10m ?? 0),
      windDir: degToDir(weather.current?.wind_direction_10m ?? 0),
      waterTemperature: marine.current?.sea_surface_temperature != null
        ? Math.round(marine.current.sea_surface_temperature)
        : null,
      sunrise: formatTimeBrasilia(weather.daily?.sunrise?.[0] ?? ''),
      sunset: formatTimeBrasilia(weather.daily?.sunset?.[0] ?? ''),
    }
  } catch {
    return null
  }
}

// ── Fonte 2: Stormglass (server-side — 10 req/dia no free tier) ───────────────

async function fetchStormglass(lat: string, lng: string): Promise<ForecastResult | null> {
  const key = process.env.STORMGLASS_API_KEY
  if (!key) return null

  try {
    const params = 'waveHeight,wavePeriod,waveDirection,swellHeight,swellPeriod,swellDirection,windSpeed,windDirection,waterTemperature'
    const res = await fetch(
      `https://api.stormglass.io/v2/weather/point?lat=${lat}&lng=${lng}&params=${params}`,
      { headers: { Authorization: key } }
    )
    interface StormglassHour { time: string; [key: string]: Record<string, number> | string }
    const data = await res.json() as { hours?: StormglassHour[] }
    if (!data.hours?.length) return null

    const nowMs = Date.now()
    const hour = data.hours.reduce((best, h) =>
      Math.abs(new Date(h.time).getTime() - nowMs) < Math.abs(new Date(best.time).getTime() - nowMs) ? h : best
    )

    const pick = (k: string): number | null => {
      const obj = hour[k]
      if (!obj || typeof obj === 'string') return null
      const vals = Object.values(obj).filter((v): v is number => typeof v === 'number')
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    }

    const wH = pick('swellHeight') ?? pick('waveHeight')
    if (!wH || Number.isNaN(wH)) return null

    const windSpd = pick('windSpeed') // m/s
    return {
      waveHeight: Number(wH.toFixed(1)),
      swellPeriod: Math.round(pick('swellPeriod') ?? pick('wavePeriod') ?? 8),
      swellDirection: degToDir(pick('swellDirection') ?? pick('waveDirection') ?? 90),
      windSpeed: Math.round((windSpd ?? 0) * 3.6),
      windDir: degToDir(pick('windDirection') ?? 0),
      waterTemperature: pick('waterTemperature') != null ? Math.round(pick('waterTemperature')!) : null,
    }
  } catch {
    return null
  }
}

// ── Condição do tempo (sol/nublado/chuva) ──────────────────────────────────────

export interface WeatherCondition {
  code: number
  label: string
  icon: 'sun' | 'cloud-sun' | 'cloud' | 'rain' | 'storm'
}

function mapWeatherCode(code: number, isDay: boolean): WeatherCondition {
  // Códigos WMO da Open-Meteo (https://open-meteo.com/en/docs) agrupados no que
  // importa pro surfista: sol, nublado, chuva ou tempestade.
  if (code === 0) return { code, label: isDay ? 'Sol' : 'Céu limpo', icon: 'sun' }
  if (code <= 2) return { code, label: 'Parcialmente nublado', icon: 'cloud-sun' }
  if (code === 3 || code === 45 || code === 48) return { code, label: 'Nublado', icon: 'cloud' }
  if ([95, 96, 99].includes(code)) return { code, label: 'Tempestade', icon: 'storm' }
  if (code >= 51) return { code, label: 'Chuva', icon: 'rain' }
  return { code, label: 'Nublado', icon: 'cloud' }
}

async function fetchWeatherCondition(lat: string, lng: string): Promise<WeatherCondition | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=weather_code,is_day`,
      { signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return null
    const data = await res.json() as { current?: { weather_code?: number; is_day?: number } }
    if (data.current?.weather_code == null) return null
    return mapWeatherCode(data.current.weather_code, data.current.is_day !== 0)
  } catch {
    return null
  }
}

// ── Rate limiting simples por IP ──────────────────────────────────────────────
// 30 requisições por IP por janela de 60s
const checkRateLimit = createRateLimiter(30)

// ── Handler principal ─────────────────────────────────────────────────────────

export default async function handler(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
    })
  }

  const url = new URL(req.url)
  const lat = url.searchParams.get('lat')
  const lng = url.searchParams.get('lng')
  const orientation = parseInt(url.searchParams.get('orientation') ?? '90')

  if (!isValidCoord(lat, lng)) {
    return new Response(JSON.stringify({ error: 'lat/lng inválidos' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const allowedOrigin = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'
  const corsHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowedOrigin }

  try {
    // Cascade: Windy (melhor qualidade) → Open-Meteo (gratuito) → Stormglass (fallback).
    // Condição do tempo é buscada em paralelo, independente de qual fonte de onda/vento
    // ganhar a cascade acima (Windy não retorna weather_code) — se falhar, weatherCondition
    // fica null e o frontend simplesmente não mostra o badge, sem quebrar o resto.
    const [result, weatherCondition] = await Promise.all([
      (async () => (await fetchWindy(lat!, lng!))
        ?? (await fetchOpenMeteo(lat!, lng!))
        ?? (await fetchStormglass(lat!, lng!))
      )(),
      fetchWeatherCondition(lat!, lng!),
    ])

    if (!result) {
      return new Response(JSON.stringify({ error: 'Nenhuma fonte disponível' }), { status: 503, headers: corsHeaders })
    }

    // Sunrise/sunset vem junto com fetchOpenMeteo quando ela é a fonte escolhida
    let sunrise = result.sunrise ?? '', sunset = result.sunset ?? ''
    if (!sunrise || !sunset) {
      try {
        const sunRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=sunrise,sunset&wind_speed_unit=kmh&timezone=America%2FSao_Paulo`)
        const sunData = await sunRes.json() as { daily?: { sunrise?: string[]; sunset?: string[] } }
        sunrise = formatTimeBrasilia(sunData.daily?.sunrise?.[0] ?? '')
        sunset = formatTimeBrasilia(sunData.daily?.sunset?.[0] ?? '')
      } catch { /* sunrise/sunset não crítico */ }
    }

    const exposedWaveHeight = applyDirectionalExposure(result.waveHeight, result.swellDirection, orientation)

    return new Response(JSON.stringify({
      waveHeight: exposedWaveHeight,
      swellPeriod: result.swellPeriod,
      swellDirection: result.swellDirection,
      windSpeed: result.windSpeed,
      windDirection: result.windDir,
      waterTemperature: result.waterTemperature,
      sunrise,
      sunset,
      weatherCondition,
    }), { headers: corsHeaders })
  } catch {
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500, headers: corsHeaders })
  }
}
