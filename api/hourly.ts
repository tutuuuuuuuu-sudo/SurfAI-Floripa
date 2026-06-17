export const config = { runtime: 'edge' }

import { calculateSurfScore } from './_scoreEngine.js'

const ALLOWED_ORIGIN = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

function degreesToDir(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]
}

function isValidCoord(lat: string | null, lng: string | null): boolean {
  if (!lat || !lng) return false
  const latN = parseFloat(lat), lngN = parseFloat(lng)
  return !isNaN(latN) && !isNaN(lngN) && latN >= -90 && latN <= 90 && lngN >= -180 && lngN <= 180
}

import { verifyPremiumToken } from './_auth.js'

export interface HourlySlot {
  hour: number        // 0-23
  label: string       // "06h", "07h", etc.
  score: number
  waveHeight: number
  windSpeed: number
  windDirection: string
  swellPeriod: number
  isPeak: boolean     // true = melhor janela do dia
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const url = new URL(req.url)
  const lat = url.searchParams.get('lat')
  const lng = url.searchParams.get('lng')
  const orientation = parseInt(url.searchParams.get('orientation') ?? '90', 10)

  if (!isValidCoord(lat, lng)) return json({ error: 'lat/lng inválidos' }, 400)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim() ?? null
  const isPremium = await verifyPremiumToken(token)
  if (!isPremium) return json({ error: 'Premium required' }, 403)

  try {
    const [marineRes, weatherRes] = await Promise.all([
      fetch(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}` +
        `&hourly=wave_height,wave_period,swell_wave_height,swell_wave_period,swell_wave_direction` +
        `&length_unit=metric&timezone=America%2FSao_Paulo&forecast_days=2`
      ),
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
        `&hourly=wind_speed_10m,wind_direction_10m` +
        `&wind_speed_unit=kmh&timezone=America%2FSao_Paulo&forecast_days=2`
      ),
    ])

    if (!marineRes.ok || !weatherRes.ok) return json({ error: 'Dados indisponíveis' }, 503)

    interface MarineHourly {
      time: string[]
      wave_height?: number[]
      wave_period?: number[]
      swell_wave_height?: number[]
      swell_wave_period?: number[]
      swell_wave_direction?: number[]
    }
    interface WeatherHourly {
      time: string[]
      wind_speed_10m?: number[]
      wind_direction_10m?: number[]
    }

    const marine = await marineRes.json() as { hourly?: MarineHourly }
    const weather = await weatherRes.json() as { hourly?: WeatherHourly }

    const times = marine.hourly?.time ?? []
    const nowHour = new Date().getHours()
    const today = new Date().toISOString().slice(0, 10)

    // Filtra apenas as horas de hoje, a partir da hora atual
    const slots: HourlySlot[] = []
    times.forEach((t, i) => {
      const date = t.slice(0, 10)
      const hour = parseInt(t.slice(11, 13), 10)
      if (date !== today) return

      const waveHeight = Number(
        (marine.hourly?.swell_wave_height?.[i] ?? marine.hourly?.wave_height?.[i] ?? 1.0).toFixed(1)
      )
      const swellPeriod = Math.round(
        marine.hourly?.swell_wave_period?.[i] ?? marine.hourly?.wave_period?.[i] ?? 10
      )
      const windSpeed = Math.round(weather.hourly?.wind_speed_10m?.[i] ?? 12)
      const windDeg = weather.hourly?.wind_direction_10m?.[i] ?? 0
      const windDirection = degreesToDir(windDeg)
      const score = Number(calculateSurfScore(waveHeight, windSpeed, swellPeriod, windDirection, orientation).toFixed(1))

      slots.push({ hour, label: `${String(hour).padStart(2, '0')}h`, score, waveHeight, windSpeed, windDirection, swellPeriod, isPeak: false })
    })

    if (slots.length === 0) return json({ error: 'Sem dados horários' }, 503)

    // Marca a melhor janela (score mais alto)
    const peakScore = Math.max(...slots.map(s => s.score))
    const peakIdx = slots.findIndex(s => s.score === peakScore)
    if (peakIdx >= 0) slots[peakIdx].isPeak = true

    // Melhor janela futura (a partir de agora)
    const futureSlots = slots.filter(s => s.hour >= nowHour)
    const bestFuture = futureSlots.reduce((best, s) => s.score > best.score ? s : best, futureSlots[0] ?? slots[0])

    return json({ slots, bestWindow: bestFuture, isPremium: true })
  } catch {
    return json({ error: 'Erro interno' }, 500)
  }
}
