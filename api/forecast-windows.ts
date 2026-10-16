export const config = { runtime: 'edge' }

// Resumo dos 14 dias das 14 praias (api/_beachDays.ts) pra aba Previsão — "melhores janelas da
// quinzena" — e pro "seu mar ideal" das Sessões. Grátis recebe os mesmos 3 dias da previsão
// grátis; os outros dias nem chegam ao navegador (mesma regra de api/forecast.ts).

import { getIslandForecast } from './_beachDays.js'
import { verifyToken, isPremiumUser } from './_auth.js'
import { FREE_DAYS } from '../src/lib/weatherData.js'
import { createRateLimiter } from './_httpUtils.js'

const ALLOWED_ORIGIN = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS },
  })
}

const checkRateLimit = createRateLimiter(30)
const PREMIUM_DAYS = 14

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!checkRateLimit(ip)) return json({ error: 'Too Many Requests' }, 429)

  let isPremium = false
  const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim()
  if (token) {
    const { valid, userId } = await verifyToken(token)
    if (valid && userId) isPremium = await isPremiumUser(userId)
  }
  const days = isPremium ? PREMIUM_DAYS : FREE_DAYS

  try {
    const island = await getIslandForecast()
    if (island.beaches.length === 0) return json({ error: 'Previsão indisponível' }, 503)
    return json({
      isPremium,
      days,
      today: island.today,
      beaches: island.beaches.map(b => ({ ...b, days: b.days.filter(d => d.dayIndex < days) })),
    })
  } catch (err) {
    console.error('[forecast-windows] erro:', err)
    return json({ error: 'Erro interno' }, 500)
  }
}
