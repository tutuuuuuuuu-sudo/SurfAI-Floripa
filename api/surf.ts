export const config = { runtime: 'edge' }

// ── Utilitários ───────────────────────────────────────────────────────────────

const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

function degToDir(deg: number): string {
  return DIRS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]
}

const DIR_TO_DEG: Record<string, number> = {
  'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
  'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
  'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
  'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5,
}

function classifyWind(direction: string, orientation: number): string {
  const windDeg = DIR_TO_DEG[direction] ?? 0
  const terralSource = (orientation + 180) % 360
  let diff = Math.abs(windDeg - terralSource)
  if (diff > 180) diff = 360 - diff
  if (diff <= 50) return `${direction} (Terral)`
  if (diff <= 90) return `${direction} (Lateral)`
  return `${direction} (Frontal)`
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
    if ((waveData as any).error || (windData as any).error) return null

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

    const marine = await marineRes.json() as any
    const weather = await weatherRes.json() as any
    if (marine.error || weather.error) return null

    const waveHeight = Number((marine.current?.swell_wave_height ?? marine.current?.wave_height ?? 0).toFixed(1))
    if (waveHeight < 0.1) return null

    return {
      waveHeight,
      swellPeriod: Math.round(marine.current?.swell_wave_period ?? marine.current?.wave_period ?? 8),
      swellDirection: degToDir(marine.current?.swell_wave_direction ?? marine.current?.wave_direction ?? 180),
      windSpeed: Math.round(weather.current?.wind_speed_10m ?? 0),
      windDir: degToDir(weather.current?.wind_direction_10m ?? 0),
      waterTemperature: marine.current?.sea_surface_temperature != null
        ? Math.round(marine.current.sea_surface_temperature)
        : null,
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
    const data = await res.json() as any
    if (!data.hours?.length) return null

    const nowMs = Date.now()
    const hour = data.hours.reduce((best: any, h: any) =>
      Math.abs(new Date(h.time).getTime() - nowMs) < Math.abs(new Date(best.time).getTime() - nowMs) ? h : best
    )

    const pick = (k: string): number | null => {
      const obj = hour[k]
      if (!obj) return null
      const vals = Object.values(obj) as number[]
      return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null
    }

    const wH = pick('swellHeight') ?? pick('waveHeight')
    if (!wH) return null

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

// ── Handler principal ─────────────────────────────────────────────────────────

export default async function handler(req: Request) {
  const url = new URL(req.url)
  const lat = url.searchParams.get('lat')
  const lng = url.searchParams.get('lng')
  const orientation = parseInt(url.searchParams.get('orientation') ?? '90')
  const fetchTide = url.searchParams.get('tide') === 'true'

  if (!isValidCoord(lat, lng)) {
    return new Response(JSON.stringify({ error: 'lat/lng inválidos' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const allowedOrigin = process.env.APP_URL ?? 'https://surf-ai-floripa.vercel.app'
  const corsHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowedOrigin }

  try {
    // Cascade: Windy (melhor qualidade) → Open-Meteo (gratuito) → Stormglass (fallback)
    const result = (await fetchWindy(lat!, lng!))
      ?? (await fetchOpenMeteo(lat!, lng!))
      ?? (await fetchStormglass(lat!, lng!))

    if (!result) {
      return new Response(JSON.stringify({ error: 'Nenhuma fonte disponível' }), { status: 503, headers: corsHeaders })
    }

    // Sunrise/sunset via Open-Meteo (sempre gratuito, não precisa chave)
    let sunrise = '', sunset = ''
    try {
      const sunRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=sunrise,sunset&wind_speed_unit=kmh&timezone=America%2FSao_Paulo`)
      const sunData = await sunRes.json() as any
      sunrise = formatTimeBrasilia(sunData.daily?.sunrise?.[0] ?? '')
      sunset = formatTimeBrasilia(sunData.daily?.sunset?.[0] ?? '')
    } catch { /* sunrise/sunset não crítico */ }

    // Maré via Stormglass (apenas se solicitado e chave disponível)
    let tideData: { time: string; height: number; type?: string }[] = []
    if (fetchTide) {
      const stormKey = process.env.STORMGLASS_API_KEY
      if (stormKey) {
        try {
          const now = new Date()
          const start = new Date(now); start.setHours(0, 0, 0, 0)
          const end = new Date(now); end.setHours(23, 59, 59, 999)
          const tideRes = await fetch(
            `https://api.stormglass.io/v2/tide/extremes/point?lat=${lat}&lng=${lng}&start=${start.toISOString()}&end=${end.toISOString()}`,
            { headers: { Authorization: stormKey } }
          )
          if (tideRes.ok) {
            const tideJson = await tideRes.json() as any
            tideData = (tideJson.data ?? []).map((item: any) => ({
              time: item.time,
              height: Number(item.height.toFixed(2)),
              type: item.type,
            }))
          }
        } catch { /* maré não crítico */ }
      }
    }

    return new Response(JSON.stringify({
      waveHeight: result.waveHeight,
      swellPeriod: result.swellPeriod,
      swellDirection: result.swellDirection,
      windSpeed: result.windSpeed,
      windDirection: classifyWind(result.windDir, orientation),
      waterTemperature: result.waterTemperature,
      sunrise,
      sunset,
      tideData,
    }), { headers: corsHeaders })
  } catch {
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500, headers: corsHeaders })
  }
}
