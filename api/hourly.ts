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

import { verifyPremiumToken } from './_auth.js'
import { isValidCoord, createRateLimiter } from './_httpUtils.js'

// Rate limit por IP: 60 req/min
const checkHourlyRateLimit = createRateLimiter(60)

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

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!checkHourlyRateLimit(ip)) {
    return json({ error: 'Too Many Requests' }, 429)
  }

  const url = new URL(req.url)
  const lat = url.searchParams.get('lat')
  const lng = url.searchParams.get('lng')
  const orientation = parseInt(url.searchParams.get('orientation') ?? '90', 10)

  if (!isValidCoord(lat, lng)) return json({ error: 'lat/lng inválidos' }, 400)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim() ?? ''
  const isPremium = await verifyPremiumToken(token)
  if (!isPremium) return json({ error: 'Premium required' }, 403)

  try {
    const hourly = await fetchHourlyForecast(lat!, lng!, 2)
    if (!hourly) return json({ error: 'Dados indisponíveis' }, 503)

    const nowHour = new Date().getHours()
    const today = new Date().toISOString().slice(0, 10)

    // Filtra apenas as horas de hoje, a partir da hora atual
    const slots: HourlySlot[] = []
    hourly.times.forEach((t, i) => {
      const date = t.slice(0, 10)
      const hour = parseInt(t.slice(11, 13), 10)
      if (date !== today) return

      const reading = hourly.readHour(i, orientation)
      if (!reading) return

      slots.push({
        hour, label: `${String(hour).padStart(2, '0')}h`, score: reading.score,
        waveHeight: reading.waveHeight, windSpeed: reading.windSpeed,
        windDirection: reading.windDirection, swellPeriod: reading.swellPeriod, isPeak: false,
      })
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
