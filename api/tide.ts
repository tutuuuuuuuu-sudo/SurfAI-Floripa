export const config = { runtime: 'edge' }

import { createRateLimiter } from './_httpUtils.js'
import { fetchTideData } from './_tide.js'

const ALLOWED_ORIGIN = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Temperatura sazonal de fallback calibrada para Florianópolis (jan-dez)
const SEASONAL_TEMP = [25, 25, 24, 22, 21, 20, 19, 18, 19, 20, 22, 24]

async function fetchWaterTemp(): Promise<number> {
  // Achado 25/set/2026: a NOAA era a Fonte 1 e passou a travar até estourar os 8s de
  // timeout em toda chamada — a resposta levava ~8.5s, o app desistia aos 8s, tentava
  // 3x, e a Home inteira caía em "Erro ao carregar as condições" (a busca das praias
  // esperava a temperatura da água terminar). Open-Meteo responde em <1s, virou a
  // Fonte 1; NOAA fica de reserva, com timeout curto pra nunca segurar a resposta.

  // Fonte 1: Open-Meteo Marine SST
  try {
    const res = await fetch(
      'https://marine-api.open-meteo.com/v1/marine?latitude=-27.62&longitude=-48.48&current=sea_surface_temperature&models=meteofrance_wave',
      { signal: AbortSignal.timeout(4000) }
    )
    if (res.ok) {
      const data = await res.json() as { current?: { sea_surface_temperature?: number } }
      const sst = data.current?.sea_surface_temperature
      if (sst != null && sst >= 15 && sst <= 30) return Math.round(sst)
    }
  } catch { /* tenta próxima */ }

  // Fonte 2: NOAA ERDDAP — SST satélite
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const url = `https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplMURSST41.json?analysed_sst[${yesterday}T09:00:00Z][(-27.62)][(-48.48)]`
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    if (res.ok) {
      const data = await res.json() as { table?: { rows?: [string, string, string, number][] } }
      const sst = data?.table?.rows?.[0]?.[3]
      if (typeof sst === 'number' && sst >= 15 && sst <= 30) return Math.round(sst)
    }
  } catch { /* fallback */ }

  return SEASONAL_TEMP[new Date().getMonth()]
}

// ── Rate limiting simples por IP ──────────────────────────────────────────────
// 20 requisições por IP por janela de 60s
const checkRateLimit = createRateLimiter(20)

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '60', ...CORS },
    })
  }

  const url = new URL(req.url)
  const type = url.searchParams.get('type') ?? 'tide'

  if (type === 'temp') {
    const temp = await fetchWaterTemp()
    return new Response(JSON.stringify({ temp }), {
      // Temperatura da água muda devagar — cache compartilhado de 1h na Vercel, então
      // quase nenhum usuário espera pela fonte externa (mesmo esquema de api/surf.ts)
      headers: { 'Content-Type': 'application/json', 'Vercel-CDN-Cache-Control': 'max-age=3600, stale-while-revalidate=21600', ...CORS },
    })
  }

  // type === 'tide' (padrão)
  const tide = await fetchTideData()
  if (!tide) {
    return new Response(JSON.stringify({ error: 'Dados de maré indisponíveis' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  return new Response(JSON.stringify(tide), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
