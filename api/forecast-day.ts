export const config = { runtime: 'edge' }

// Detalhe hora a hora de UM dia específico da previsão de 14 dias — pedido do usuário
// 31/ago/2026: cada card de dia em Forecast.tsx só mostrava um resumo (melhor hora do dia);
// clicar num card agora abre uma página com a evolução hora a hora daquele dia específico,
// não só o resumo que já aparecia no card.
import { fetchHourlyForecast, type HourReading } from './_hourlyForecast.js'

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
import { isValidCoord, createRateLimiter } from './_httpUtils.js'

const checkForecastDayRateLimit = createRateLimiter(60)

// Mesma janela "surfável" usada em forecast.ts pra escolher a melhor hora do dia — evita
// cravar o resumo com base numa hora de madrugada que ninguém vai encarar.
const DAY_START_HOUR = 5
const DAY_END_HOUR = 20

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!checkForecastDayRateLimit(ip)) return json({ error: 'Too Many Requests' }, 429)

  const url = new URL(req.url)
  const lat = url.searchParams.get('lat')
  const lng = url.searchParams.get('lng')
  const orientation = parseInt(url.searchParams.get('orientation') ?? '90', 10)
  const dayIndex = parseInt(url.searchParams.get('dayIndex') ?? '0', 10)

  if (!isValidCoord(lat, lng)) return json({ error: 'lat/lng inválidos' }, 400)
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 13) {
    return json({ error: 'dayIndex inválido' }, 400)
  }

  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '').trim()
  if (!token) return json({ error: 'Unauthorized' }, 401)
  const { valid, userId } = await verifyToken(token)
  if (!valid || !userId) return json({ error: 'Unauthorized' }, 401)
  const isPremium = await isPremiumUser(userId)

  // Mesmo gate de dia 4-14 que forecast.ts já aplica (FREE_DAYS=3) — sem isso um usuário free
  // conseguiria pedir o detalhe de um dia bloqueado direto por essa rota.
  if (!isPremium && dayIndex >= FREE_DAYS) {
    return json({ error: 'Premium required', code: 'NOT_PREMIUM' }, 403)
  }

  try {
    const hourly = await fetchHourlyForecast(lat!, lng!, dayIndex + 1)
    if (!hourly) return json({ error: 'Dados meteorológicos indisponíveis' }, 503)

    const startIdx = dayIndex * 24
    if (startIdx >= hourly.times.length) return json({ error: 'Dados meteorológicos indisponíveis' }, 503)

    const date = hourly.times[startIdx].slice(0, 10)
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const dateObj = new Date(date + 'T12:00:00')
    const dayName = dayIndex === 0 ? 'Hoje' : dayIndex === 1 ? 'Amanhã' : dayNames[dateObj.getDay()]

    const hours: (HourReading & { hour: number })[] = []
    for (let h = 0; h < 24; h++) {
      const idx = startIdx + h
      if (idx >= hourly.times.length) break
      const reading = hourly.readHour(idx, orientation)
      if (reading) hours.push({ hour: h, ...reading })
    }
    if (hours.length === 0) return json({ error: 'Dados meteorológicos indisponíveis' }, 503)

    // Melhor hora dentro da janela surfável, mesmo critério de forecast.ts — onda/vento/
    // período sempre vêm do mesmo horário, nunca de picos independentes.
    const surfableHours = hours.filter(h => h.hour >= DAY_START_HOUR && h.hour <= DAY_END_HOUR)
    const best = (surfableHours.length > 0 ? surfableHours : hours)
      .reduce((a, b) => (b.score > a.score ? b : a))

    return json({
      date, dayName, dayIndex,
      hours,
      best,
      sunriseHour: hourly.sunriseHour,
      sunsetHour: hourly.sunsetHour,
    })
  } catch {
    return json({ error: 'Erro interno' }, 500)
  }
}
