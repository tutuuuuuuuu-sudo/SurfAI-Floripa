export const config = { runtime: 'edge' }
import { calculateSurfScore } from './_scoreEngine.js'
import { callGemini } from './_gemini.js'
import { getBeaches } from './_beachRegistry.js'

const APP_URL = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'
const GEMINI_KEY = process.env.GEMINI_API_KEY
const AGENT_SECRET = process.env.AGENT_SECRET
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
const CALLMEBOT_PHONE = process.env.CALLMEBOT_PHONE
const CALLMEBOT_APIKEY = process.env.CALLMEBOT_APIKEY

const SPOTS = getBeaches(['campeche', 'joaquina', 'mole', 'barra-lagoa', 'santinho', 'morro-pedras'])

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

  // Brasil não usa horário de verão desde 2019 — UTC-3 fixo é correto
  // Subtrai 3h para obter "agora em BRT", zera para meia-noite BRT, soma 3h de volta para UTC
  const brtNow = new Date(Date.now() - 3 * 60 * 60 * 1000)
  brtNow.setUTCHours(0, 0, 0, 0)
  const todayISO = new Date(brtNow.getTime() + 3 * 60 * 60 * 1000).toISOString()

  try {
    // Total de usuários
    const [totalRes, premiumRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      }),
      fetch(`${SUPABASE_URL}/rest/v1/subscriptions?status=eq.premium&expires_at=gte.${new Date().toISOString()}&select=id,created_at,plan,amount`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      }),
    ])

    interface SubRecord { id: string; created_at: string; plan?: string; amount?: number }
    interface AuthUsersResponse { total?: number; users?: { id: string; created_at: string }[] }

    const totalData = totalRes.ok ? await totalRes.json() as AuthUsersResponse : {}
    const premiumData = premiumRes.ok ? await premiumRes.json() as SubRecord[] : []

    const premiumActive = Array.isArray(premiumData) ? premiumData.length : 0
    const newPremiumToday = Array.isArray(premiumData)
      ? premiumData.filter((s) => s.created_at >= todayISO).length
      : 0
    const revenueToday = Array.isArray(premiumData)
      ? premiumData
          .filter((s) => s.created_at >= todayISO)
          .reduce((sum, s) => sum + (s.amount ?? 16.90), 0)
      : 0

    // Cancelamentos (subscriptions com status cancelled, atualizadas hoje)
    const cancelRes = await fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?status=eq.cancelled&updated_at=gte.${todayISO}&select=id`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
    )
    const cancelData = cancelRes.ok ? await cancelRes.json() as { id: string }[] : []
    const cancelledToday = Array.isArray(cancelData) ? cancelData.length : 0

    // Total de usuários via Content-Range (não carrega todos os registros na memória)
    const countRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          Prefer: 'count=exact',
          Range: '0-0',
        }
      }
    )
    const contentRange = countRes.headers.get('Content-Range') ?? ''
    const total = parseInt(contentRange.split('/')[1] ?? '0') || (totalData.total ?? 0)

    // Novos usuários hoje via Content-Range (evita carregar registros só para contar)
    const newTodayRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id&created_at=gte.${todayISO}`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          Prefer: 'count=exact',
          Range: '0-0',
        }
      }
    )
    const newTodayRange = newTodayRes.headers.get('Content-Range') ?? ''
    const newToday = parseInt(newTodayRange.split('/')[1] ?? '0') || 0

    // MRR real: assinatura mensal conta o valor cheio, anual é dividida por 12
    const mrr = Array.isArray(premiumData)
      ? premiumData.reduce((sum, s) => {
          const amount = s.amount ?? (s.plan === 'annual' ? 149.90 : 16.90)
          return sum + (s.plan === 'annual' ? amount / 12 : amount)
        }, 0)
      : 0
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
    const results = await Promise.all(
      SPOTS.map(async (s) => {
        try {
          const res = await fetch(
            `${APP_URL}/api/surf?lat=${s.lat}&lng=${s.lng}&orientation=${s.orientation}`,
            { signal: AbortSignal.timeout(10000) }
          )
          if (!res.ok) return null
          const d = await res.json() as { waveHeight?: number; swellPeriod?: number; windSpeed?: number; windDirection?: string }
          const dir = (d.windDirection ?? 'N').toUpperCase()
          const score = calculateSurfScore(d.waveHeight ?? 0, d.windSpeed ?? 0, d.swellPeriod ?? 0, dir, s.orientation)
          return { name: s.name, score, waveHeight: d.waveHeight, swellPeriod: d.swellPeriod, windSpeed: d.windSpeed, windDirection: d.windDirection }
        } catch { return null }
      })
    )

    const valid = results.filter(Boolean) as SpotResult[]
    if (valid.length === 0) return fallback

    const sorted = valid.sort((a, b) => b.score - a.score)
    const best = sorted[0]
    const avg = Number((valid.reduce((s, r) => s + r.score, 0) / valid.length).toFixed(1))

    // Temporada da tainha: 1° de maio a 31 de julho (conforme tainha.ts)
    const month = new Date().getMonth() + 1
    const tainhaSeasonActive = month >= 5 && month <= 7

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
  if (!GEMINI_KEY) return ''

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

  const result = await callGemini(GEMINI_KEY, prompt, 3000)
  return result.ok ? result.text : ''
}

// ── WhatsApp (CallMeBot) ─────────────────────────────────────────────────────

function medal(i: number): string {
  return i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
}

function buildWhatsAppText(data: {
  period: string
  date: string
  users: Awaited<ReturnType<typeof getUserStats>>
  surf: Awaited<ReturnType<typeof getSurfConditions>>
  aiSummary: string
}): string {
  const { period, date, users, surf, aiSummary } = data
  const greeting = period === 'Manhã' ? 'Bom dia' : 'Boa noite'

  const lines = [
    `🏄 *Surf AI · Relatório ${period} · ${date}*`,
    '',
    `${greeting}! Resumo do app:`,
    '',
    `Usuários: ${users.total} (+${users.newToday} hoje)`,
    `Premium ativo: ${users.premiumActive} (+${users.newPremiumToday} hoje)`,
    `Receita hoje: R$ ${users.revenueToday.toFixed(2)}`,
    `MRR estimado: R$ ${users.mrr.toFixed(2)}`,
    `Conversão: ${users.conversionRate}%`,
  ]

  if (users.cancelledToday > 0) lines.push(`Cancelamentos: ${users.cancelledToday}`)

  lines.push('', `Melhor praia agora: ${surf.bestSpot} (${surf.bestScore}/10)`, `Score médio: ${surf.avgScore}/10`)

  const top3Lines = surf.top3.map((s, i) => `${medal(i)} ${s.name} — ${s.score}/10`).join('\n')
  if (top3Lines) lines.push('', top3Lines)

  if (surf.tainhaSeasonActive) lines.push('', '🐟 Temporada da tainha ativa')

  if (aiSummary) lines.push('', aiSummary)

  return lines.join('\n')
}

async function sendReportWhatsApp(data: {
  period: string
  date: string
  users: Awaited<ReturnType<typeof getUserStats>>
  surf: Awaited<ReturnType<typeof getSurfConditions>>
  aiSummary: string
}): Promise<boolean> {
  if (!CALLMEBOT_PHONE || !CALLMEBOT_APIKEY) return false

  const text = buildWhatsAppText(data)

  try {
    const res = await fetch(
      `https://api.callmebot.com/whatsapp.php?phone=${CALLMEBOT_PHONE}&apikey=${CALLMEBOT_APIKEY}&text=${encodeURIComponent(text)}`,
      { signal: AbortSignal.timeout(10000) }
    )
    return res.ok
  } catch {
    return false
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: Request) {
  const url = new URL(req.url)
  const secret = req.headers.get('x-agent-secret') ?? url.searchParams.get('secret')

  // Cron roda via GitHub Actions (ver .github/workflows/daily-report.yml), autenticado por secret
  if (!AGENT_SECRET) {
    console.error('[daily-report] AGENT_SECRET não configurado')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (secret !== AGENT_SECRET) {
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

  const whatsappSent = await sendReportWhatsApp({ period, date: dateStr, users, surf, aiSummary })

  return new Response(JSON.stringify({
    period,
    date: dateStr,
    users,
    surf,
    aiSummary,
    whatsappSent,
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
