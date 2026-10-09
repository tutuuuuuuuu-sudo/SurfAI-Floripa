export const config = { runtime: 'edge' }

// Como estava o mar numa praia, numa hora já passada — pra sessão do diário se preencher
// sozinha (09/out/2026): "o app lembra o mar por você". Onda, vento, período e nota vêm do
// histórico de hora em hora (score_snapshots, o mesmo número que o app mostrava naquela hora);
// a maré vem da Open-Meteo. Dado público (o histórico já é aberto pra leitura), sem login.

import { BEACH_REGISTRY } from './_beachRegistry.js'
import { fetchTideData } from './_tide.js'
import { tideTrendAt } from './_beachDays.js'
import { createRateLimiter } from './_httpUtils.js'

const ALLOWED_ORIGIN = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cache, ...CORS },
  })
}

const checkRateLimit = createRateLimiter(60)
// O histórico guarda 30 dias (api/snapshot.ts); a Open-Meteo dá maré até 92 dias pra trás
const MAX_PAST_DAYS = 31
// Leitura mais distante da hora pedida que ainda vale (os robôs rodam de hora em hora)
const MAX_GAP_MS = 90 * 60 * 1000

interface Snapshot {
  score: number
  wave_height: number | null
  wind_speed: number | null
  wind_direction: string | null
  swell_period: number | null
  captured_at: string
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!checkRateLimit(ip)) return json({ error: 'Too Many Requests' }, 429)

  const url = new URL(req.url)
  const beachId = url.searchParams.get('beachId') ?? ''
  const date = url.searchParams.get('date') ?? ''
  const hour = Number(url.searchParams.get('hour'))
  if (!BEACH_REGISTRY.some(b => b.id === beachId)) return json({ error: 'Praia inválida' }, 400)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(hour) || hour < 0 || hour > 23) {
    return json({ error: 'Data ou hora inválida' }, 400)
  }

  // Florianópolis: UTC−3 o ano inteiro (sem horário de verão desde 2019)
  const target = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00-03:00`).getTime()
  const now = Date.now()
  const ageDays = (now - target) / 86_400_000
  if (Number.isNaN(target) || target > now + 60 * 60 * 1000 || ageDays > MAX_PAST_DAYS) {
    return json({ found: false })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return json({ error: 'Configuração incompleta' }, 500)

  const from = new Date(target - MAX_GAP_MS).toISOString()
  const to = new Date(target + MAX_GAP_MS).toISOString()
  const [snapRes, tide] = await Promise.all([
    fetch(
      `${supabaseUrl}/rest/v1/score_snapshots?beach_id=eq.${beachId}&captured_at=gte.${from}&captured_at=lte.${to}` +
      `&select=score,wave_height,wind_speed,wind_direction,swell_period,captured_at`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    ).catch(() => null),
    fetchTideData(1, Math.min(92, Math.ceil(ageDays) + 1)),
  ])
  const snaps = snapRes?.ok ? await snapRes.json() as Snapshot[] : []
  const closest = snaps.reduce<Snapshot | null>((best, s) => {
    const gap = Math.abs(new Date(s.captured_at).getTime() - target)
    return !best || gap < Math.abs(new Date(best.captured_at).getTime() - target) ? s : best
  }, null)
  const tideTrend = tideTrendAt(tide, date, hour)

  if (!closest && !tideTrend) return json({ found: false })

  // Hora que já passou não muda mais: pode ficar no cache da Vercel
  const cache = now - target > 2 * 60 * 60 * 1000 ? 'public, s-maxage=86400' : 'no-store'
  return json({
    found: true,
    waveHeight: closest?.wave_height != null ? Number(closest.wave_height) : null,
    windSpeed: closest?.wind_speed ?? null,
    windDirection: closest?.wind_direction ?? null,
    swellPeriod: closest?.swell_period ?? null,
    score: closest ? Number(closest.score) : null,
    tideTrend,
  }, 200, cache)
}
