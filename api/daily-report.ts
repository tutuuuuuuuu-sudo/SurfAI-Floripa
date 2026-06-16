export const config = { runtime: 'edge' }
import { calculateSurfScore } from './_scoreEngine.js'

const APP_URL = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const AGENT_SECRET = process.env.AGENT_SECRET
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY
const REPORT_EMAIL = process.env.REPORT_EMAIL

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

  // Brasil não usa horário de verão desde 2019 — UTC-3 fixo é correto
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  todayStart.setTime(todayStart.getTime() + 3 * 60 * 60 * 1000) // +3h = meia-noite BRT
  const todayISO = todayStart.toISOString()

  try {
    // Total de usuários
    const [totalRes, premiumRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      }),
      fetch(`${SUPABASE_URL}/rest/v1/subscriptions?status=eq.premium&select=id,created_at,plan,amount`, {
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
          .reduce((sum, s) => sum + (s.amount ?? 2990), 0) / 100
      : 0

    // Cancelamentos (subscriptions com status cancelled hoje)
    const cancelRes = await fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?status=eq.cancelled&cancelled_at=gte.${todayISO}&select=id`,
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

    // Novos usuários hoje via RPC (evita carregar até 500 registros só para contar)
    const newTodayRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/count_new_users_today`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ since: todayISO }),
    })
    const newToday = newTodayRes.ok ? (await newTodayRes.json() as number) || 0 : 0

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
    const results = await Promise.all(
      SPOTS.map(async (s) => {
        try {
          const res = await fetch(
            `${APP_URL}/api/surf?lat=${s.lat}&lng=${s.lng}&orientation=${s.orientation}`,
            { signal: AbortSignal.timeout(10000) }
          )
          if (!res.ok) return null
          const d = await res.json() as { waveHeight?: number; swellPeriod?: number; windSpeed?: number; windDirection?: string }
          const dir = (d.windDirection ?? 'N').split(' ')[0].split('(')[0].trim()
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
    const d = await res.json() as { content?: { text?: string }[] }
    return d.content?.[0]?.text ?? ''
  } catch {
    return ''
  }
}

// ── Email ─────────────────────────────────────────────────────────────────────

const GITHUB_ACTIONS_URL = process.env.GITHUB_ACTIONS_URL ?? ''

function scoreColor(score: number): string {
  if (score >= 8.5) return '#a855f7' // épico — roxo
  if (score >= 7)   return '#22c55e' // excelente — verde
  if (score >= 5.5) return '#3b82f6' // bom — azul
  if (score >= 4)   return '#eab308' // regular — amarelo
  return '#ef4444'                   // ruim — vermelho
}

function conditionLabel(score: number): string {
  if (score >= 8.5) return 'ÉPICO'
  if (score >= 7) return 'EXCELENTE'
  if (score >= 5.5) return 'BOM'
  if (score >= 4) return 'REGULAR'
  return 'RUIM'
}

function medal(i: number): string {
  return i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'
}

function buildEmailHtml(data: {
  period: string
  date: string
  users: Awaited<ReturnType<typeof getUserStats>>
  surf: Awaited<ReturnType<typeof getSurfConditions>>
  aiSummary: string
}): string {
  const { period, date, users, surf, aiSummary } = data
  const greeting = period === 'Manhã' ? 'Bom dia!' : 'Boa noite!'

  const top3Rows = surf.top3.map((s, i) => `
    <tr>
      <td style="padding:12px 14px;border-bottom:1px solid #1a1a1a;font-size:14px;">
        ${medal(i)} <strong>${s.name}</strong>
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid #1a1a1a;text-align:center;">
        <span style="color:${scoreColor(s.score)};font-weight:700;font-size:18px;">${s.score}</span>
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid #1a1a1a;text-align:center;">
        <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;color:${scoreColor(s.score)};background:#1a1a1a;letter-spacing:0.5px;">${conditionLabel(s.score)}</span>
      </td>
      <td style="padding:12px 10px;border-bottom:1px solid #1a1a1a;text-align:right;font-size:12px;color:#666;">
        ${s.waveHeight}m · ${s.swellPeriod}s · ${s.windSpeed}km/h
      </td>
    </tr>
  `).join('')

  const supabaseDashUrl = process.env.SUPABASE_DASHBOARD_URL ?? 'https://supabase.com'

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#050505;font-family:'Helvetica Neue',Arial,sans-serif;color:#e5e5e5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#0d0d0d;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#111;padding:28px 32px;border-bottom:1px solid #1f1f1f;">
            <p style="margin:0 0 6px;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1.5px;">RELATÓRIO ${period.toUpperCase()} · ${date}</p>
            <h1 style="margin:0;font-size:24px;font-weight:700;">${greeting} Aqui está o resumo do app</h1>
          </td>
        </tr>

        <!-- Stats 2x2 -->
        <tr>
          <td style="padding:24px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" style="padding:0 8px 16px 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1f1f1f;border-radius:8px;background:#111;">
                    <tr><td style="padding:16px;">
                      <p style="margin:0 0 10px;font-size:10px;color:#555;text-transform:uppercase;letter-spacing:1px;">USUÁRIOS TOTAIS</p>
                      <p style="margin:0;font-size:28px;font-weight:700;color:#fff;">${users.total}</p>
                      <p style="margin:6px 0 0;font-size:12px;color:#555;">${users.newToday} novos hoje</p>
                    </td></tr>
                  </table>
                </td>
                <td width="50%" style="padding:0 0 16px 8px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1f1f1f;border-radius:8px;background:#111;">
                    <tr><td style="padding:16px;">
                      <p style="margin:0 0 10px;font-size:10px;color:#555;text-transform:uppercase;letter-spacing:1px;">PREMIUM ATIVO</p>
                      <p style="margin:0;font-size:28px;font-weight:700;color:#a855f7;">${users.premiumActive}</p>
                      <p style="margin:6px 0 0;font-size:12px;color:#555;">${users.newPremiumToday} novos hoje</p>
                    </td></tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td width="50%" style="padding:0 8px 0 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1f1f1f;border-radius:8px;background:#111;">
                    <tr><td style="padding:16px;">
                      <p style="margin:0 0 10px;font-size:10px;color:#555;text-transform:uppercase;letter-spacing:1px;">RECEITA HOJE</p>
                      <p style="margin:0;font-size:22px;font-weight:700;color:${users.revenueToday > 0 ? '#22c55e' : '#fff'};">R$ ${users.revenueToday.toFixed(2)}</p>
                      <p style="margin:6px 0 0;font-size:12px;color:#555;">${users.cancelledToday === 0 ? 'sem cancelamentos' : users.cancelledToday + ' cancelamento(s)'}</p>
                    </td></tr>
                  </table>
                </td>
                <td width="50%" style="padding:0 0 0 8px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1f1f1f;border-radius:8px;background:#111;">
                    <tr><td style="padding:16px;">
                      <p style="margin:0 0 10px;font-size:10px;color:#555;text-transform:uppercase;letter-spacing:1px;">MRR ESTIMADO</p>
                      <p style="margin:0;font-size:22px;font-weight:700;color:${users.mrr > 0 ? '#22c55e' : '#fff'};">R$ ${users.mrr.toFixed(2)}</p>
                      <p style="margin:6px 0 0;font-size:12px;color:#555;">${users.conversionRate}% de conversão</p>
                    </td></tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Tainha banner -->
        ${surf.tainhaSeasonActive ? `
        <tr>
          <td style="padding:20px 32px 0;">
            <p style="margin:0;padding:12px 16px;background:#0f2d2e;border:1px solid #134e4e;border-radius:8px;font-size:13px;color:#2dd4bf;">
              🐟 Temporada da tainha ativa — maio a agosto
            </p>
          </td>
        </tr>` : ''}

        <!-- Top 3 praias -->
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0 0 14px;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">TOP 3 PRAIAS AGORA · SCORE MÉDIO: ${surf.avgScore}/10</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1f1f1f;border-radius:8px;overflow:hidden;">
              <tbody>${top3Rows}</tbody>
            </table>
          </td>
        </tr>

        <!-- Resumo IA -->
        ${aiSummary ? `
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0 0 12px;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">Análise do Dia</p>
            <p style="margin:0;font-size:13px;line-height:1.7;color:#bbb;background:#111;padding:14px 16px;border-radius:8px;border-left:3px solid #a855f7;">${aiSummary}</p>
          </td>
        </tr>` : ''}

        <!-- Status dos agentes -->
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0 0 12px;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">Status dos Agentes</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1f1f1f;border-radius:8px;background:#111;">
              <tr><td style="padding:16px;">
                <p style="margin:0 0 8px;font-size:13px;color:#ccc;"><span style="color:#22c55e;margin-right:8px;">✓</span>Email alert — agendado (8h e 19h BRT)</p>
                <p style="margin:0 0 8px;font-size:13px;color:#ccc;"><span style="color:#22c55e;margin-right:8px;">✓</span>Agente de conteúdo — agendado (10h e 13h BRT)</p>
                <p style="margin:0 0 16px;font-size:13px;color:#ccc;"><span style="color:#22c55e;margin-right:8px;">✓</span>Relatório diário — este email (7h e 20h BRT)</p>
                <p style="margin:0;font-size:11px;color:#444;">
                  <a href="${GITHUB_ACTIONS_URL}" style="color:#555;text-decoration:none;">github.com → Actions</a>
                  <span style="color:#2a2a2a;margin:0 8px;">|</span>
                  <a href="${supabaseDashUrl}" style="color:#555;text-decoration:none;">supabase.com → Dashboard</a>
                  <span style="color:#2a2a2a;margin:0 8px;">|</span>
                  <a href="${APP_URL}" style="color:#555;text-decoration:none;">surfaifloripa.com.br</a>
                </p>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px;border-top:1px solid #1a1a1a;margin-top:24px;">
            <p style="margin:0;font-size:11px;color:#333;">Surf AI Floripa · Relatório automático ${period.toLowerCase()} · ${date}</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

async function sendReportEmail(data: {
  period: string
  date: string
  users: Awaited<ReturnType<typeof getUserStats>>
  surf: Awaited<ReturnType<typeof getSurfConditions>>
  aiSummary: string
}): Promise<boolean> {
  if (!RESEND_API_KEY || !REPORT_EMAIL) return false

  const subject = `[${data.period}] Surf AI · ${data.date} — MRR R$${data.users.mrr.toFixed(0)} · ${data.surf.bestSpot} ${data.surf.bestScore}/10`
  const html = buildEmailHtml(data)

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Surf AI Floripa <onboarding@resend.dev>',
        to: [REPORT_EMAIL],
        subject,
        html,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: Request) {
  const url = new URL(req.url)
  const secret = req.headers.get('x-agent-secret') ?? url.searchParams.get('secret')

  // Crons internos da Vercel chegam como GET sem secret — permite apenas esse caso
  const isVercelCron = req.method === 'GET' && !req.headers.get('x-agent-secret')
  if (!isVercelCron) {
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
  }

  const hourBRT = (new Date().getUTCHours() - 3 + 24) % 24
  const period = hourBRT < 14 ? 'Manhã' : 'Noite'
  const dateStr = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date())

  const [users, surf] = await Promise.all([
    getUserStats(),
    getSurfConditions(),
  ])

  const aiSummary = await generateSummary({ period, users, surf })

  const emailSent = await sendReportEmail({ period, date: dateStr, users, surf, aiSummary })

  return new Response(JSON.stringify({
    period,
    date: dateStr,
    users,
    surf,
    aiSummary,
    emailSent,
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
