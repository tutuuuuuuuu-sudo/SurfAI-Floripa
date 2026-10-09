export const config = { runtime: 'edge' }

// Detalhe hora a hora de UM dia específico da previsão de 14 dias — pedido do usuário
// 31/ago/2026: cada card de dia em Forecast.tsx só mostrava um resumo (melhor hora do dia);
// clicar num card agora abre uma página com a evolução hora a hora daquele dia específico,
// não só o resumo que já aparecia no card.
import { buildDayDetail } from './_dayDetail.js'

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
    const detail = await buildDayDetail(lat!, lng!, orientation, dayIndex)
    if (!detail) return json({ error: 'Dados meteorológicos indisponíveis' }, 503)
    return json(detail)
  } catch {
    return json({ error: 'Erro interno' }, 500)
  }
}
