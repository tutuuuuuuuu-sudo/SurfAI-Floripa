export const config = { runtime: 'edge' }

// Contador anônimo da landing (tabela landing_stats, migração 20260929180000): soma +1 no
// total do dia pra uma visita (`view`) ou um clique num botão de cadastro/planos (`cta`, com o
// lugar do botão). Nada identifica a pessoa — sem cookie, sem IP gravado (o IP só passa pelo
// limite de requisições em memória), sem id de usuário —, por isso não depende do aviso de
// cookies. A lista fechada de eventos impede lixo na tabela. Chamado por src/lib/landingStats.ts.
import { createRateLimiter } from './_httpUtils.js'

const ALLOWED_ORIGIN = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const EVENTS: Record<string, readonly string[]> = {
  view: [''],
  cta: ['nav', 'hero', 'hero-planos', 'curva', 'preco-mensal', 'preco-anual', 'preco-gratis', 'teste-gratis', 'fechamento', 'fechamento-planos'],
}
const checkRateLimit = createRateLimiter(40)

const empty = (status: number) => new Response(null, { status, headers: CORS })

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return empty(204)
  if (req.method !== 'POST') return empty(405)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!checkRateLimit(ip)) return empty(429)

  // sendBeacon manda como texto; aceita os dois
  let event = '', detail = ''
  try {
    const body = JSON.parse(await req.text()) as { event?: unknown; detail?: unknown }
    event = String(body.event ?? '')
    detail = String(body.detail ?? '')
  } catch {
    return empty(400)
  }
  if (!EVENTS[event]?.includes(detail)) return empty(400)

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return empty(204)
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/bump_landing_stat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ p_event: event, p_detail: detail }),
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) console.error(`[landing-event] HTTP ${res.status} ao somar ${event}/${detail}`)
  } catch (err) {
    console.error('[landing-event] erro ao somar:', err)
  }
  return empty(204)
}
