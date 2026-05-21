export const config = { runtime: 'edge' }

const APP_URL = process.env.APP_URL ?? 'https://surf-ai-floripa.vercel.app'
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const AGENT_SECRET = process.env.AGENT_SECRET
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY
const REPORT_EMAIL = process.env.REPORT_EMAIL ?? 'r2rgarraza@gmail.com'

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

// ── Email ─────────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 8) return '#22c55e'
  if (score >= 6) return '#eab308'
  if (score >= 4) return '#f97316'
  return '#ef4444'
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

  const top3Rows = surf.top3.map((s, i) => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #1a1a1a;font-size:14px;">
        ${medal(i)} <strong>${s.name}</strong>
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #1a1a1a;text-align:center;">
        <span style="color:${scoreColor(s.score)};font-weight:700;font-size:16px;">${s.score}</span>
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #1a1a1a;text-align:center;font-size:13px;color:#aaa;">
        ${s.waveHeight}m · ${s.swellPeriod}s · ${s.windSpeed}km/h
      </td>
    </tr>
  `).join('')

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
            <p style="margin:0 0 4px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:1px;">Surf AI Floripa</p>
            <h1 style="margin:0;font-size:22px;font-weight:700;">Relatório de ${period} · ${date}</h1>
          </td>
        </tr>

        <!-- Métricas de usuários -->
        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0 0 16px;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">Usuários</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="25%" style="text-align:center;padding:0 8px 20px;">
                  <p style="margin:0;font-size:28px;font-weight:700;color:#fff;">${users.total}</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#666;">Total</p>
                </td>
                <td width="25%" style="text-align:center;padding:0 8px 20px;">
                  <p style="margin:0;font-size:28px;font-weight:700;color:${users.newToday > 0 ? '#22c55e' : '#fff'};">+${users.newToday}</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#666;">Novos hoje</p>
                </td>
                <td width="25%" style="text-align:center;padding:0 8px 20px;">
                  <p style="margin:0;font-size:28px;font-weight:700;color:#a855f7;">${users.premiumActive}</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#666;">Premium</p>
                </td>
                <td width="25%" style="text-align:center;padding:0 8px 20px;">
                  <p style="margin:0;font-size:28px;font-weight:700;color:#22c55e;">R$${users.mrr.toFixed(0)}</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#666;">MRR</p>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1a1a1a;padding-top:16px;">
              <tr>
                <td width="33%" style="text-align:center;padding:12px 8px;">
                  <p style="margin:0;font-size:18px;font-weight:600;color:${users.newPremiumToday > 0 ? '#22c55e' : '#fff'};">+${users.newPremiumToday}</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#666;">Novos premium hoje</p>
                </td>
                <td width="33%" style="text-align:center;padding:12px 8px;">
                  <p style="margin:0;font-size:18px;font-weight:600;color:${users.cancelledToday > 0 ? '#ef4444' : '#fff'};">${users.cancelledToday}</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#666;">Cancelamentos</p>
                </td>
                <td width="33%" style="text-align:center;padding:12px 8px;">
                  <p style="margin:0;font-size:18px;font-weight:600;">${users.conversionRate}%</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#666;">Conversão free→premium</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Condições do mar -->
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0 0 16px;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">Condições do Mar</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #1a1a1a;">
              <thead>
                <tr style="background:#111;">
                  <th style="padding:10px 8px;text-align:left;font-size:11px;color:#666;font-weight:500;">Praia</th>
                  <th style="padding:10px 8px;text-align:center;font-size:11px;color:#666;font-weight:500;">Score</th>
                  <th style="padding:10px 8px;text-align:center;font-size:11px;color:#666;font-weight:500;">Condições</th>
                </tr>
              </thead>
              <tbody>${top3Rows}</tbody>
            </table>
            ${surf.tainhaSeasonActive ? `
            <p style="margin:12px 0 0;padding:10px 14px;background:#422006;border-radius:6px;font-size:12px;color:#fb923c;">
              Temporada da tainha ativa — restrições em algumas praias.
            </p>` : ''}
          </td>
        </tr>

        <!-- Resumo IA -->
        ${aiSummary ? `
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0 0 12px;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">Análise do Dia</p>
            <p style="margin:0;font-size:14px;line-height:1.7;color:#ccc;background:#111;padding:16px;border-radius:8px;border-left:3px solid #a855f7;">${aiSummary}</p>
          </td>
        </tr>` : ''}

        <!-- Footer -->
        <tr>
          <td style="padding:28px 32px;margin-top:8px;border-top:1px solid #1a1a1a;margin-top:24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:11px;color:#444;">
                  Surf AI Floripa · Relatório automático
                </td>
                <td style="text-align:right;">
                  <a href="${APP_URL}" style="font-size:11px;color:#666;text-decoration:none;">Ver app</a>
                </td>
              </tr>
            </table>
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
  if (!RESEND_API_KEY) return false

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
