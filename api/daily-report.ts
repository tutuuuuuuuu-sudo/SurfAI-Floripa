export const config = { runtime: 'edge' }

const APP_URL = process.env.APP_URL ?? 'https://surf-ai-floripa.vercel.app'
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const AGENT_SECRET = process.env.AGENT_SECRET
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY

const SPOTS = [
  { name: 'Campeche',        lat: -27.697703, lng: -48.4898603, orientation: 90 },
  { name: 'Joaquina',        lat: -27.6293577, lng: -48.4490173, orientation: 90 },
  { name: 'Praia Mole',      lat: -27.6022459, lng: -48.4326839, orientation: 85 },
  { name: 'Barra da Lagoa',  lat: -27.5734502, lng: -48.424939,  orientation: 75 },
  { name: 'Santinho',        lat: -27.4618653, lng: -48.3761513, orientation: 70 },
  { name: 'Morro das Pedras',lat: -27.7170897, lng: -48.503436,  orientation: 100 },
]

// ── Fontes de dados ───────────────────────────────────────────────────────────

async function getUserStats(): Promise<{
  total: number
  newToday: number
  premiumActive: number
  newPremiumToday: number
  revenueToday: number
  cancelledToday: number
  mrr: number
  conversionRate: number
}> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { total: 0, newToday: 0, premiumActive: 0, newPremiumToday: 0, revenueToday: 0, cancelledToday: 0, mrr: 0, conversionRate: 0 }
  }

  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  // Ajuste para BRT (UTC-3)
  todayStart.setTime(todayStart.getTime() + 3 * 60 * 60 * 1000)
  const todayISO = todayStart.toISOString()

  try {
    // Total de usuários
    const [totalRes, newTodayRes, premiumRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      }),
      fetch(`${SUPABASE_URL}/rest/v1/rpc/count_new_users_today`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ since: todayISO }),
      }),
      fetch(`${SUPABASE_URL}/rest/v1/subscriptions?status=eq.active&select=id,created_at,plan,amount`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      }),
    ])

    const totalData = totalRes.ok ? await totalRes.json() as any : {}
    const premiumData = premiumRes.ok ? await premiumRes.json() as any[] : []

    const premiumActive = Array.isArray(premiumData) ? premiumData.length : 0
    const newPremiumToday = Array.isArray(premiumData)
      ? premiumData.filter((s: any) => s.created_at >= todayISO).length
      : 0
    const revenueToday = Array.isArray(premiumData)
      ? premiumData
          .filter((s: any) => s.created_at >= todayISO)
          .reduce((sum: number, s: any) => sum + (s.amount ?? 2990), 0) / 100
      : 0

    // Cancelamentos (subscriptions com status cancelled hoje)
    const cancelRes = await fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?status=eq.cancelled&cancelled_at=gte.${todayISO}&select=id`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
    )
    const cancelData = cancelRes.ok ? await cancelRes.json() as any[] : []
    const cancelledToday = Array.isArray(cancelData) ? cancelData.length : 0

    // Novos usuários hoje (via auth.users)
    const usersRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?per_page=500`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
    )
    const usersData = usersRes.ok ? await usersRes.json() as any : {}
    const allUsers: any[] = usersData.users ?? []
    const newToday = allUsers.filter((u: any) => u.created_at >= todayISO).length
    const total = totalData.total ?? allUsers.length

    const mrr = premiumActive * 29.90
    const conversionRate = total > 0 ? Number(((premiumActive / total) * 100).toFixed(1)) : 0

    return { total, newToday, premiumActive, newPremiumToday, revenueToday, cancelledToday, mrr, conversionRate }
  } catch {
    return { total: 0, newToday: 0, premiumActive: 0, newPremiumToday: 0, revenueToday: 0, cancelledToday: 0, mrr: 0, conversionRate: 0 }
  }
}

interface SpotResult {
  name: string
  score: number
  waveHeight: number
  swellPeriod: number
  windSpeed: number
  windDirection: string
}

async function getSurfConditions(): Promise<{
  bestSpot: string
  bestScore: number
  avgScore: number
  bestWave: number
  bestPeriod: number
  bestWind: number
  bestWindDir: string
  top3: SpotResult[]
  tainhaSeasonActive: boolean
}> {
  const fallback = { bestSpot: 'N/A', bestScore: 0, avgScore: 0, bestWave: 0, bestPeriod: 0, bestWind: 0, bestWindDir: 'N/A', top3: [], tainhaSeasonActive: false }
  try {
    const WIND_DEG: Record<string, number> = {
      N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
      S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
    }

    function calcScore(h: number, w: number, p: number, dir: string, orientation: number): number {
      let base = h >= 2.5 ? 10 : h >= 2.0 ? 9.5 : h >= 1.5 ? 9.0 : h >= 1.2 ? 8.5 : h >= 1.0 ? 8.0
        : h >= 0.8 ? 7.5 : h >= 0.6 ? 7.0 : h >= 0.5 ? 6.5 : h >= 0.4 ? 5.5 : 4.0
      const offshore = (orientation + 180) % 360
      let diff = Math.abs((WIND_DEG[dir] ?? 0) - offshore)
      if (diff > 180) diff = 360 - diff
      const penalty = diff <= 45
        ? (w <= 10 ? 0 : w <= 15 ? -0.3 : w <= 20 ? -0.8 : -1.5)
        : diff <= 90
        ? (w <= 10 ? -0.5 : w <= 15 ? -1.0 : w <= 20 ? -1.8 : -2.5)
        : (w <= 10 ? -1.0 : w <= 15 ? -2.0 : w <= 20 ? -3.0 : -4.0)
      const pAdj = p >= 16 ? 0.5 : p >= 14 ? 0.3 : p >= 12 ? 0.2 : p >= 10 ? 0 : p >= 8 ? -0.2 : p >= 7 ? -0.4 : -0.6
      return Math.min(10, Math.max(1, Number((base + penalty + pAdj).toFixed(1))))
    }

    const results = await Promise.all(
      SPOTS.map(async (s) => {
        try {
          const res = await fetch(
            `${APP_URL}/api/surf?lat=${s.lat}&lng=${s.lng}&orientation=${s.orientation}`,
            { signal: AbortSignal.timeout(10000) }
          )
          if (!res.ok) return null
          const d = await res.json() as any
          const dir = (d.windDirection ?? 'N').split(' ')[0].split('(')[0].trim()
          const score = calcScore(d.waveHeight, d.windSpeed, d.swellPeriod, dir, s.orientation)
          return { name: s.name, score, waveHeight: d.waveHeight, swellPeriod: d.swellPeriod, windSpeed: d.windSpeed, windDirection: d.windDirection }
        } catch { return null }
      })
    )

    const valid = results.filter(Boolean) as SpotResult[]
    if (valid.length === 0) return fallback

    const sorted = valid.sort((a, b) => b.score - a.score)
    const best = sorted[0]
    const avg = Number((valid.reduce((s, r) => s + r.score, 0) / valid.length).toFixed(1))

    // Temporada da tainha: maio a agosto
    const month = new Date().getMonth() + 1
    const tainhaSeasonActive = month >= 5 && month <= 8

    return {
      bestSpot: best.name,
      bestScore: best.score,
      avgScore: avg,
      bestWave: best.waveHeight,
      bestPeriod: best.swellPeriod,
      bestWind: best.windSpeed,
      bestWindDir: best.windDirection,
      top3: sorted.slice(0, 3),
      tainhaSeasonActive,
    }
  } catch {
    return fallback
  }
}


async function generateSummary(data: {
  period: string
  users: Awaited<ReturnType<typeof getUserStats>>
  surf: Awaited<ReturnType<typeof getSurfConditions>>
}): Promise<string> {
  if (!ANTHROPIC_KEY) return ''

  const prompt = `Você é um assistente de negócios do app Surf AI Floripa. Escreva um relatório executivo curto e direto em português para o dono do app.

Período: ${data.period}

DADOS DO DIA:
- Usuários totais: ${data.users.total}
- Novos cadastros hoje: ${data.users.newToday}
- Assinaturas Premium ativas: ${data.users.premiumActive}
- Novas assinaturas hoje: ${data.users.newPremiumToday}
- Receita hoje: R$ ${data.users.revenueToday.toFixed(2)}
- Cancelamentos hoje: ${data.users.cancelledToday}
- MRR estimado: R$ ${data.users.mrr.toFixed(2)}
- Taxa de conversão free→premium: ${data.users.conversionRate}%

CONDIÇÕES DO MAR:
- Melhor praia: ${data.surf.bestSpot} (score ${data.surf.bestScore}/10)
- Score médio das praias: ${data.surf.avgScore}/10
- Condições: ondas ${data.surf.bestWave}m, período ${data.surf.bestPeriod}s, vento ${data.surf.bestWind}km/h ${data.surf.bestWindDir}
- Temporada da tainha: ${data.surf.tainhaSeasonActive ? 'ATIVA' : 'fora de temporada'}

Escreva 3-4 frases de análise: o que foi bom, o que precisa de atenção, e uma ação sugerida se necessário. Tom direto e profissional, sem emojis.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return ''
    const d = await res.json() as any
    return d.content?.[0]?.text ?? ''
  } catch {
    return ''
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: Request) {
  const url = new URL(req.url)
  const isForceTest = url.searchParams.get('force') === 'true'
  const secret = req.headers.get('x-agent-secret') ?? url.searchParams.get('secret')
  if (!isForceTest && AGENT_SECRET && secret !== AGENT_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const hourBRT = (new Date().getUTCHours() - 3 + 24) % 24
  const period = hourBRT < 14 ? 'Manhã' : 'Noite'
  const dateStr = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date())

  const [users, surf] = await Promise.all([
    getUserStats(),
    getSurfConditions(),
  ])

  const aiSummary = await generateSummary({ period, users, surf })

  return new Response(JSON.stringify({
    period,
    date: dateStr,
    users,
    surf,
    aiSummary,
    githubActionsUrl: 'https://github.com/tutuuuuuuuu-sudo/SurfAI-Floripa/actions',
    supabaseUrl: SUPABASE_URL ? `${SUPABASE_URL.replace('/rest/v1', '').replace('https://', 'https://supabase.com/dashboard/project/')}` : null,
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
