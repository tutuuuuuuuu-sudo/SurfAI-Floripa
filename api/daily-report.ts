export const config = { runtime: 'edge' }
import { calculateSurfScore } from './_scoreEngine.js'
import { callGemini } from './_gemini.js'
import { cleanChatReply } from './_chatText.js'
import { getBeaches } from './_beachRegistry.js'
import { isSchedulerCall } from './_auth.js'
import { sendWhatsApp } from './_callmebot.js'
import { PRICE_MONTHLY, PRICE_ANNUAL } from '../src/lib/pricing.js'

const APP_URL = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'
const GEMINI_KEY = process.env.GEMINI_API_KEY
const AGENT_SECRET = process.env.AGENT_SECRET
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
const CALLMEBOT_PHONE = process.env.CALLMEBOT_PHONE
const CALLMEBOT_APIKEY = process.env.CALLMEBOT_APIKEY

const SPOTS = getBeaches(['campeche', 'joaquina', 'mole', 'barra-lagoa', 'santinho', 'morro-pedras'])

// Contas do founder e da família, usadas pra testar o app — excluídas de todas as
// contagens do relatório (usuários, assinantes, MRR) pra não confundir os números reais
// (surfaifloripa@gmail.com, r2rgarraza@gmail.com — conta pessoal do founder — e sergiogarraza@gmail.com)
const EXCLUDED_USER_IDS = [
  '8989de89-2c74-468c-b963-6e4011175d82',
  '16237659-67f0-456a-abb8-e8a0bbc3e4fb',
  '147f3924-a8ee-46ff-9e3b-2b4d583c0ed6',
]
const excludeFilter = (column: string) => `${column}=not.in.(${EXCLUDED_USER_IDS.join(',')})`

// ── Fontes de dados ───────────────────────────────────────────────────────────

async function getUserStats(): Promise<{
  total: number
  newToday: number
  premiumActive: number
  courtesyActive: number
  trialsActive: number
  newPremiumToday: number
  revenueToday: number
  cancelledToday: number
  mrr: number
  conversionRate: number
}> {
  const empty = { total: 0, newToday: 0, premiumActive: 0, courtesyActive: 0, trialsActive: 0, newPremiumToday: 0, revenueToday: 0, cancelledToday: 0, mrr: 0, conversionRate: 0 }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return empty

  // Brasil não usa horário de verão desde 2019 — UTC-3 fixo é correto
  // Subtrai 3h para obter "agora em BRT", zera para meia-noite BRT, soma 3h de volta para UTC
  const brtNow = new Date(Date.now() - 3 * 60 * 60 * 1000)
  brtNow.setUTCHours(0, 0, 0, 0)
  const todayISO = new Date(brtNow.getTime() + 3 * 60 * 60 * 1000).toISOString()

  try {
    // Cadastros (total e novos hoje) contados direto de auth.users pela função report_user_counts
    // — a tabela profiles, usada antes, só tem linha de parte dos usuários
    const [countRes, premiumRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/rpc/report_user_counts`, {
        method: 'POST',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_since: todayISO, p_exclude: EXCLUDED_USER_IDS }),
      }),
      fetch(`${SUPABASE_URL}/rest/v1/subscriptions?status=eq.premium&expires_at=gte.${new Date().toISOString()}&${excludeFilter('user_id')}&select=id,created_at,plan,amount`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      }),
    ])

    interface SubRecord { id: string; created_at: string; plan?: string; amount?: number | null }

    const counts = countRes.ok ? await countRes.json() as { total: number; new_since: number }[] : []
    if (!countRes.ok) console.error('[daily-report] report_user_counts voltou', countRes.status, (await countRes.text()).slice(0, 200))
    const total = counts[0]?.total ?? 0
    const newToday = counts[0]?.new_since ?? 0

    // Teste grátis (plan 'trial') também é status premium, mas não é assinatura: fica de fora de
    // Premium ativo, receita, MRR e conversão, e aparece numa linha própria. Cortesia (valor 0,
    // dada à mão) também não é assinatura paga: aparece separada. Linha antiga sem valor (null)
    // continua contando como paga.
    const allPremium = premiumRes.ok ? await premiumRes.json() as SubRecord[] : []
    const nonTrial = Array.isArray(allPremium) ? allPremium.filter(s => s.plan !== 'trial') : []
    const trialsActive = Array.isArray(allPremium) ? allPremium.length - nonTrial.length : 0
    const isCourtesy = (s: SubRecord) => s.amount != null && Number(s.amount) === 0
    const premiumData = nonTrial.filter(s => !isCourtesy(s))
    const courtesyActive = nonTrial.length - premiumData.length

    const premiumActive = premiumData.length
    const newPremiumToday = Array.isArray(premiumData)
      ? premiumData.filter((s) => s.created_at >= todayISO).length
      : 0
    const revenueToday = Array.isArray(premiumData)
      ? premiumData
          .filter((s) => s.created_at >= todayISO)
          .reduce((sum, s) => sum + (s.amount ?? (s.plan === 'annual' ? PRICE_ANNUAL : PRICE_MONTHLY)), 0)
      : 0

    // Cancelamentos (subscriptions com status cancelled, atualizadas hoje)
    const cancelRes = await fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?status=eq.cancelled&updated_at=gte.${todayISO}&${excludeFilter('user_id')}&select=id`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
    )
    const cancelData = cancelRes.ok ? await cancelRes.json() as { id: string }[] : []
    const cancelledToday = Array.isArray(cancelData) ? cancelData.length : 0

    // MRR real: assinatura mensal conta o valor cheio, anual é dividida por 12
    const mrr = Array.isArray(premiumData)
      ? premiumData.reduce((sum, s) => {
          const amount = s.amount ?? (s.plan === 'annual' ? PRICE_ANNUAL : PRICE_MONTHLY)
          return sum + (s.plan === 'annual' ? amount / 12 : amount)
        }, 0)
      : 0
    const conversionRate = total > 0 ? Number(((premiumActive / total) * 100).toFixed(1)) : 0

    return { total, newToday, premiumActive, courtesyActive, trialsActive, newPremiumToday, revenueToday, cancelledToday, mrr, conversionRate }
  } catch (err) {
    console.error('[daily-report] getUserStats falhou:', err)
    return empty
  }
}

// Contador anônimo da landing (api/landing-event.ts → tabela landing_stats, dia em horário de
// Brasília): visitas e cliques em cada botão, hoje e nos últimos 7 dias
const CTA_LABEL: Record<string, string> = {
  nav: 'menu', hero: 'topo', 'hero-planos': 'topo/planos', curva: 'curva',
  'preco-mensal': 'mensal', 'preco-anual': 'anual', 'preco-gratis': 'grátis', 'teste-gratis': 'teste grátis',
  fechamento: 'final', 'fechamento-planos': 'final/planos',
}

// Data (AAAA-MM-DD) em Brasília, `daysAgo` dias atrás — mesma conta de UTC-3 fixo do todayISO acima
const brtDate = (daysAgo = 0) => new Date(Date.now() - 3 * 60 * 60 * 1000 - daysAgo * 86400000).toISOString().slice(0, 10)

async function getLandingStats(): Promise<{ viewsToday: number; clicksToday: number; clicksTodayBy: string; views7d: number; clicks7d: number } | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/landing_stats?day=gte.${brtDate(6)}&select=day,event,detail,count`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const rows = await res.json() as { day: string; event: string; detail: string; count: number }[]
    const today = brtDate()
    const sum = (f: (r: typeof rows[number]) => boolean) => rows.filter(f).reduce((n, r) => n + r.count, 0)
    const clicksTodayBy = rows
      .filter(r => r.day === today && r.event === 'cta')
      .sort((a, b) => b.count - a.count)
      .map(r => `${CTA_LABEL[r.detail] ?? r.detail} ${r.count}`)
      .join(', ')
    return {
      viewsToday: sum(r => r.day === today && r.event === 'view'),
      clicksToday: sum(r => r.day === today && r.event === 'cta'),
      clicksTodayBy,
      views7d: sum(r => r.event === 'view'),
      clicks7d: sum(r => r.event === 'cta'),
    }
  } catch {
    return null
  }
}

// Robôs chamados pelo agendador do Supabase (tabela robot_runs, preenchida por public.call_robot
// e public.collect_robot_results): quantos deram certo e quais falharam nas últimas 24 h
const ROBOT_LABEL: Record<string, string> = {
  '/api/snapshot': 'histórico', '/api/push-notify': 'alertas', '/api/refresh-windy-cache': 'praias',
  '/api/email-alert': 'e-mail', '/api/daily-report': 'relatório', '/api/health': 'checagem',
  '/api/plan-reminders': 'lembretes',
}

async function getRobotStats(): Promise<{ ok: number; failed: number; failedBy: string } | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null
  try {
    const since = new Date(Date.now() - 24 * 3600000).toISOString()
    const res = await fetch(`${SUPABASE_URL}/rest/v1/robot_runs?called_at=gte.${since}&select=path,ok,called_at`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const rows = await res.json() as { path: string; ok: boolean | null; called_at: string }[]
    // sem resposta depois de 15 min também conta como falha (a própria chamada deste relatório,
    // ainda em andamento, fica de fora)
    const stale = Date.now() - 15 * 60000
    const failedRows = rows.filter(r => r.ok === false || (r.ok === null && Date.parse(r.called_at) < stale))
    const byPath = new Map<string, number>()
    for (const r of failedRows) byPath.set(r.path, (byPath.get(r.path) ?? 0) + 1)
    return {
      ok: rows.filter(r => r.ok === true).length,
      failed: failedRows.length,
      failedBy: [...byPath].map(([p, n]) => `${ROBOT_LABEL[p] ?? p} ${n}`).join(', '),
    }
  } catch {
    return null
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
          const score = calculateSurfScore(d.waveHeight ?? 0, d.windSpeed ?? 0, d.swellPeriod ?? 0, dir, s.orientation, s.southExposure ?? 1)
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
  landing: Awaited<ReturnType<typeof getLandingStats>>
  robots: Awaited<ReturnType<typeof getRobotStats>>
  surf: Awaited<ReturnType<typeof getSurfConditions>>
}): Promise<{ text: string; error: string }> {
  if (!GEMINI_KEY) return { text: '', error: 'sem chave' }

  const prompt = `Você é um assistente de negócios do app Surf AI Floripa. Escreva um relatório executivo curto e direto em português para o dono do app.

Período: ${data.period}

DADOS DO DIA:
- Usuários totais: ${data.users.total}
- Novos cadastros hoje: ${data.users.newToday}
- Assinaturas Premium pagas ativas: ${data.users.premiumActive}
- Premium de cortesia (dado de graça, não paga): ${data.users.courtesyActive}
- Em teste grátis agora: ${data.users.trialsActive}
- Novas assinaturas hoje: ${data.users.newPremiumToday}
- Receita hoje: R$ ${data.users.revenueToday.toFixed(2)}
- Cancelamentos hoje: ${data.users.cancelledToday}
- MRR estimado: R$ ${data.users.mrr.toFixed(2)}
- Taxa de conversão free→premium: ${data.users.conversionRate}%
${data.landing ? `- Landing hoje: ${data.landing.viewsToday} visitas, ${data.landing.clicksToday} cliques em botão (últimos 7 dias: ${data.landing.views7d} visitas, ${data.landing.clicks7d} cliques)
` : ''}
CONDIÇÕES DO MAR:
- Melhor praia: ${data.surf.bestSpot} (score ${data.surf.bestScore}/10)
- Score médio das praias: ${data.surf.avgScore}/10
- Condições: ondas ${data.surf.bestWave}m, período ${data.surf.bestPeriod}s, vento ${data.surf.bestWind}km/h ${data.surf.bestWindDir}
- Temporada da tainha: ${data.surf.tainhaSeasonActive ? 'ATIVA' : 'fora de temporada'}

Escreva no máximo 3 frases curtas de análise (até 400 caracteres no total): o que foi bom, o que precisa de atenção, e uma ação sugerida se necessário. Tom direto e profissional, sem emojis, sem título, sem markdown, texto corrido.`

  // 15 s (padrão 20): a função edge precisa responder em ~25 s e agora manda duas mensagens
  const result = await callGemini(GEMINI_KEY, prompt, 3000, 15000)
  if (!result.ok) {
    console.error('[daily-report] Gemini falhou:', result.status, result.error.slice(0, 300))
    return { text: '', error: result.status ? `erro ${result.status}` : result.error.slice(0, 60) }
  }
  // Mesma limpeza do chat (sem asterisco, título ou travessão): em 07/out/2026 a resposta veio
  // com "**Relatório Executivo**" no topo, que o WhatsApp mostra com asteriscos sobrando
  const text = cleanChatReply(result.text)
  return text ? { text, error: '' } : { text: '', error: 'resposta vazia' }
}

// ── WhatsApp (CallMeBot) ─────────────────────────────────────────────────────

function medal(i: number): string {
  return i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
}

function buildWhatsAppText(data: {
  period: string
  date: string
  users: Awaited<ReturnType<typeof getUserStats>>
  landing: Awaited<ReturnType<typeof getLandingStats>>
  robots: Awaited<ReturnType<typeof getRobotStats>>
  surf: Awaited<ReturnType<typeof getSurfConditions>>
}): string {
  const { period, date, users, landing, robots, surf } = data
  const greeting = period === 'Manhã' ? 'Bom dia' : period === 'Tarde' ? 'Boa tarde' : 'Boa noite'

  const lines = [
    `🏄 *Surf AI · Relatório ${period} · ${date}*`,
    '',
    `${greeting}! Resumo do app:`,
    '',
    `Usuários: ${users.total} (+${users.newToday} hoje)`,
    `Premium pago: ${users.premiumActive} (+${users.newPremiumToday} hoje)`,
    ...(users.courtesyActive > 0 ? [`Cortesia: ${users.courtesyActive}`] : []),
    `Teste grátis: ${users.trialsActive}`,
    `Receita hoje: R$ ${users.revenueToday.toFixed(2)}`,
    `MRR estimado: R$ ${users.mrr.toFixed(2)}`,
    `Conversão: ${users.conversionRate}%`,
  ]

  if (users.cancelledToday > 0) lines.push(`Cancelamentos: ${users.cancelledToday}`)

  if (landing) {
    const by = landing.clicksTodayBy ? ` (${landing.clicksTodayBy})` : ''
    lines.push('', `Landing hoje: ${landing.viewsToday} visitas, ${landing.clicksToday} cliques${by}`, `Landing 7 dias: ${landing.views7d} visitas, ${landing.clicks7d} cliques`)
  }

  if (robots) {
    lines.push('', robots.failed > 0
      ? `Robôs 24h: ${robots.ok} ok, ${robots.failed} falhas (${robots.failedBy})`
      : `Robôs 24h: ${robots.ok} execuções, nenhuma falha`)
  }

  lines.push('', `Melhor praia agora: ${surf.bestSpot} (${surf.bestScore}/10)`, `Score médio: ${surf.avgScore}/10`)

  const top3Lines = surf.top3.map((s, i) => `${medal(i)} ${s.name} — ${s.score}/10`).join('\n')
  if (top3Lines) lines.push('', top3Lines)

  if (surf.tainhaSeasonActive) lines.push('', '🐟 Temporada da tainha ativa')

  return lines.join('\n')
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: Request) {
  const url = new URL(req.url)
  const secret = req.headers.get('x-agent-secret') ?? url.searchParams.get('secret')

  // Agendador do Supabase (isSchedulerCall) ou execução manual pelo GitHub (x-agent-secret)
  if (!(AGENT_SECRET && secret === AGENT_SECRET) && !(await isSchedulerCall(req))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Período pelo horário real do envio (o agendamento do GitHub, usado até 30/set/2026, chegava
  // a atrasar 5-6 h e o relatório "da manhã" saiu às 14h52 dizendo "Boa noite")
  const hourBRT = (new Date().getUTCHours() - 3 + 24) % 24
  const period = hourBRT < 12 ? 'Manhã' : hourBRT < 18 ? 'Tarde' : 'Noite'
  const dateStr = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date())

  const [users, landing, robots, surf] = await Promise.all([
    getUserStats(),
    getLandingStats(),
    getRobotStats(),
    getSurfConditions(),
  ])

  // Duas mensagens: os números saem antes de chamar a IA (a parte mais demorada) e a análise
  // vem em seguida. Juntas passavam do tamanho que o CallMeBot entrega (ver _callmebot.ts).
  const statsText = buildWhatsAppText({ period, date: dateStr, users, landing, robots, surf })
  const send = (text: string) =>
    CALLMEBOT_PHONE && CALLMEBOT_APIKEY ? sendWhatsApp(CALLMEBOT_PHONE, CALLMEBOT_APIKEY, text) : Promise.resolve(false)
  const statsSent = await send(statsText)

  const { text: aiSummary, error: aiError } = await generateSummary({ period, users, landing, robots, surf })
  const aiText = aiSummary ? `*Análise do dia*\n\n${aiSummary}` : `IA não respondeu (${aiError})`
  const aiSent = await send(aiText)

  const whatsappSent = statsSent && aiSent
  // Tamanho de cada mensagem na resposta do robô (guardada algumas horas em net._http_response)
  const whatsappChars = [statsText.length, aiText.length]

  return new Response(JSON.stringify({
    period,
    date: dateStr,
    users,
    surf,
    landing,
    robots,
    aiSummary,
    aiError,
    whatsappSent,
    whatsappChars,
  }), {
    // 502 quando a mensagem não saiu: o GitHub Actions marca a execução como falha e o Cronitor
    // avisa (antes respondia 200 mesmo sem entregar, e "deu certo" no painel não queria dizer nada)
    status: whatsappSent ? 200 : 502,
    headers: { 'Content-Type': 'application/json' },
  })
}
