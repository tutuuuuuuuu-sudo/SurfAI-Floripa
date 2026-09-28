export const config = { runtime: 'edge' }

// Previsão de AMANHÃ, hora a hora, de uma praia pública — alimenta a demonstração da curva
// do dia na landing (DayCurveDemo.tsx), que o visitante arrasta antes de ter conta. Sem login
// de propósito, mas limitada: só amanhã (nunca os 14 dias, que são Premium) e só as praias
// que já são abertas sem login no app (PUBLIC_SPOT_IDS + TEASER_SPOT_IDS em src/lib/publicSpots.ts).
// Cache compartilhado de 1h na Vercel: a previsão de amanhã muda pouco dentro de uma hora,
// então quase nenhum visitante dispara consulta na Open-Meteo.
import { buildDayDetail } from './_dayDetail.js'
import { BEACH_REGISTRY } from './_beachRegistry.js'
import { createRateLimiter } from './_httpUtils.js'
import { PUBLIC_SPOT_IDS, TEASER_SPOT_IDS } from '../src/lib/publicSpots.js'

const ALLOWED_ORIGIN = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}
const ALLOWED_IDS: readonly string[] = [...PUBLIC_SPOT_IDS, ...TEASER_SPOT_IDS]
const checkRateLimit = createRateLimiter(30)

function json(data: unknown, status = 200, cache = false) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS,
      ...(cache ? { 'Vercel-CDN-Cache-Control': 'max-age=3600, stale-while-revalidate=7200' } : {}),
    },
  })
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!checkRateLimit(ip)) return json({ error: 'Too Many Requests' }, 429)

  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!ALLOWED_IDS.includes(id)) return json({ error: 'Praia não disponível' }, 400)
  const beach = BEACH_REGISTRY.find(b => b.id === id)
  if (!beach) return json({ error: 'Praia não disponível' }, 400)

  try {
    const detail = await buildDayDetail(String(beach.lat), String(beach.lng), beach.orientation, 1)
    if (!detail) return json({ error: 'Dados meteorológicos indisponíveis' }, 503)
    return json({ ...detail, beach: { id: beach.id, name: beach.name } }, 200, true)
  } catch {
    return json({ error: 'Erro interno' }, 500)
  }
}
