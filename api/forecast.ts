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

import { verifyToken, isPremiumUser } from './_auth.js'

// FREE_DAYS deve coincidir com weatherData.ts — ambos controlam o mesmo limite de UX
const FREE_DAYS = 3
const PREMIUM_DAYS = 14

function isValidCoord(lat: string | null, lng: string | null): boolean {
  if (!lat || !lng) return false
  const latN = parseFloat(lat), lngN = parseFloat(lng)
  return !isNaN(latN) && !isNaN(lngN) && latN >= -90 && latN <= 90 && lngN >= -180 && lngN <= 180
}

function degreesToDir(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]
}


export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const url = new URL(req.url)
  const lat = url.searchParams.get('lat')
  const lng = url.searchParams.get('lng')
  const spotId = url.searchParams.get('spotId') ?? ''
  const orientation = parseInt(url.searchParams.get('orientation') ?? '90', 10)

  if (!isValidCoord(lat, lng)) return json({ error: 'lat/lng inválidos' }, 400)

  // Detecta plano do usuário a partir do token (opcional — sem token = free)
  let isPremium = false
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '').trim()

  if (token) {
    const { valid, userId } = await verifyToken(token)
    if (valid && userId) {
      isPremium = await isPremiumUser(userId)
    }
  }

  const forecastDays = isPremium ? PREMIUM_DAYS : FREE_DAYS

  try {
    const [marineRes, weatherRes] = await Promise.all([
      fetch(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}` +
        `&daily=wave_height_max,wave_period_max,swell_wave_height_max,swell_wave_period_max` +
        `&length_unit=metric&timezone=America%2FSao_Paulo&forecast_days=${forecastDays}`
      ),
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
        `&daily=wind_speed_10m_max,wind_direction_10m_dominant,temperature_2m_max` +
        `&hourly=temperature_2m&wind_speed_unit=kmh&timezone=America%2FSao_Paulo&forecast_days=${forecastDays}`
      ),
    ])

    if (!marineRes.ok || !weatherRes.ok) {
      return json({ error: 'Dados meteorológicos indisponíveis' }, 503)
    }

    interface MarineDaily {
      time: string[]
      wave_height_max?: number[]
      wave_period_max?: number[]
      swell_wave_height_max?: number[]
      swell_wave_period_max?: number[]
    }
    interface WeatherDaily {
      wind_speed_10m_max?: number[]
      wind_direction_10m_dominant?: number[]
      temperature_2m_max?: number[]
    }

    const marine = await marineRes.json() as { daily?: MarineDaily }
    const weather = await weatherRes.json() as { daily?: WeatherDaily; hourly?: { temperature_2m: number[] } }

    const days = marine.daily?.time ?? []
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const currentHour = new Date().getHours()
    const hourlyTemps: number[] = weather.hourly?.temperature_2m ?? []

    const forecasts = days.slice(0, forecastDays).map((date, i) => {
      const dateObj = new Date(date + 'T12:00:00')
      const dayName = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : dayNames[dateObj.getDay()]

      const waveHeight = Number(
        (marine.daily?.swell_wave_height_max?.[i] ?? marine.daily?.wave_height_max?.[i] ?? 1.0).toFixed(1)
      )
      const swellPeriod = Math.round(
        marine.daily?.swell_wave_period_max?.[i] ?? marine.daily?.wave_period_max?.[i] ?? 10
      )
      const windSpeed = Math.round(weather.daily?.wind_speed_10m_max?.[i] ?? 12)
      const windDeg = weather.daily?.wind_direction_10m_dominant?.[i] ?? 0
      const windDirection = degreesToDir(windDeg)

      const hourIdx = i === 0 ? currentHour : i * 24 + 12
      const temperature = hourlyTemps[hourIdx] != null
        ? Math.round(hourlyTemps[hourIdx])
        : Math.round(weather.daily?.temperature_2m_max?.[i] ?? 24)

      const score = calculateSurfScore(waveHeight, windSpeed, swellPeriod, windDirection, orientation)

      return {
        date,
        dayName,
        waveHeight,
        windSpeed,
        windDirection,
        swellPeriod,
        temperature,
        score: Number(score.toFixed(1)),
        locked: false, // nunca retorna locked=true — dados bloqueados simplesmente não chegam
      }
    })

    return json({ spotId, isPremium, forecastDays, forecasts })
  } catch {
    return json({ error: 'Erro interno' }, 500)
  }
}
