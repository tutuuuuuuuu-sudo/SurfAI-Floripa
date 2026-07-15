export const config = { runtime: 'edge' }

import { fetchHourlyForecast } from './_hourlyForecast.js'

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
import { FREE_DAYS } from '../src/lib/weatherData.js'

// Rate limit por IP: 60 req/min
const forecastRateLimit = new Map<string, { count: number; reset: number }>()
function checkForecastRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = forecastRateLimit.get(ip)
  if (!entry || now > entry.reset) {
    forecastRateLimit.set(ip, { count: 1, reset: now + 60_000 })
    return true
  }
  if (entry.count >= 60) return false
  entry.count++
  return true
}

const PREMIUM_DAYS = 14

function isValidCoord(lat: string | null, lng: string | null): boolean {
  if (!lat || !lng) return false
  const latN = parseFloat(lat), lngN = parseFloat(lng)
  return !isNaN(latN) && !isNaN(lngN) && latN >= -90 && latN <= 90 && lngN >= -180 && lngN <= 180
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!checkForecastRateLimit(ip)) {
    return json({ error: 'Too Many Requests' }, 429)
  }

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
    const hourly = await fetchHourlyForecast(lat!, lng!, forecastDays)
    if (!hourly) {
      return json({ error: 'Dados meteorológicos indisponíveis' }, 503)
    }

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

    // Janela de horário considerada "surfável" para escolher o melhor momento real do dia —
    // evita cravar a nota com base numa hora de madrugada que ninguém vai encarar.
    const DAY_START_HOUR = 5
    const DAY_END_HOUR = 20

    const daysAvailable = Math.min(forecastDays, Math.floor(hourly.times.length / 24))
    if (daysAvailable === 0) {
      return json({ error: 'Dados meteorológicos indisponíveis' }, 503)
    }

    const forecasts = Array.from({ length: daysAvailable }, (_, i) => {
      const date = hourly.times[i * 24].slice(0, 10)
      const dateObj = new Date(date + 'T12:00:00')
      const dayName = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : dayNames[dateObj.getDay()]

      // Escolhe a hora real com melhor nota dentro da janela surfável do dia — onda, vento
      // e período sempre vêm do mesmo horário, nunca de picos independentes que talvez
      // nunca aconteçam juntos de verdade.
      // Non-null: daysAvailable garante i*24+DAY_START_HOUR sempre dentro de hourly.times.
      let best = hourly.readHour(i * 24 + DAY_START_HOUR, orientation)!
      for (let h = DAY_START_HOUR + 1; h <= DAY_END_HOUR; h++) {
        const reading = hourly.readHour(i * 24 + h, orientation)
        if (reading && reading.score > best.score) best = reading
      }

      return {
        date,
        dayName,
        waveHeight: best.waveHeight,
        windSpeed: best.windSpeed,
        windDirection: best.windDirection,
        swellPeriod: best.swellPeriod,
        temperature: best.temperature,
        score: Number(best.score.toFixed(1)),
        locked: false, // nunca retorna locked=true — dados bloqueados simplesmente não chegam
      }
    })

    return json({ spotId, isPremium, forecastDays, forecasts })
  } catch {
    return json({ error: 'Erro interno' }, 500)
  }
}
