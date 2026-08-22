export const config = { runtime: 'edge' }

// Cron: GitHub Actions chama esse endpoint via .github/workflows/email-alert.yml,
// autenticado por secret. Antes esse cron reimplementava a fórmula de score inteira
// dentro do próprio YAML (3ª cópia da lógica, fora de qualquer checagem de fonte
// única) e mandava o alerta pra TODA a base cadastrada, de graça — mesmo "Alertas de
// swell" sendo um benefício exclusivo do Premium. Agora importa o motor real e só
// avisa assinantes premium ativos que não desligaram a preferência.

import { calculateSurfScore } from './_scoreEngine.js'

const AGENT_SECRET = process.env.AGENT_SECRET
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY
const APP_URL = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'
const SCORE_THRESHOLD = 6.0

const SPOTS = [
  { name: 'Campeche', lat: -27.697703, lng: -48.4898603, orientation: 90 },
  { name: 'Joaquina', lat: -27.6293577, lng: -48.4490173, orientation: 90 },
  { name: 'Praia Mole', lat: -27.6022459, lng: -48.4326839, orientation: 85 },
  { name: 'Barra da Lagoa', lat: -27.5734502, lng: -48.424939, orientation: 75 },
  { name: 'Santinho', lat: -27.4618653, lng: -48.3761513, orientation: 70 },
  { name: 'Morro das Pedras', lat: -27.7170897, lng: -48.503436, orientation: 100 },
  { name: 'Novo Campeche', lat: -27.6661001, lng: -48.4755307, orientation: 90 },
  { name: 'Moçambique', lat: -27.4937746, lng: -48.3955175, orientation: 80 },
]

interface SpotResult {
  name: string
  score: number
  waveHeight: number
  swellPeriod: number
  windSpeed: number
  windDirection: string
}

async function fetchSpotScore(spot: typeof SPOTS[number]): Promise<SpotResult | null> {
  try {
    const res = await fetch(
      `${APP_URL}/api/surf?lat=${spot.lat}&lng=${spot.lng}&orientation=${spot.orientation}`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return null
    const data = await res.json() as { waveHeight?: number; windSpeed?: number; windDirection?: string; swellPeriod?: number }
    const windDir = (data.windDirection ?? 'N').toUpperCase()
    const score = calculateSurfScore(data.waveHeight ?? 0, data.windSpeed ?? 0, data.swellPeriod ?? 0, windDir, spot.orientation)
    return { name: spot.name, score, waveHeight: data.waveHeight ?? 0, swellPeriod: data.swellPeriod ?? 0, windSpeed: data.windSpeed ?? 0, windDirection: data.windDirection ?? '' }
  } catch {
    return null
  }
}

interface Recipient { email: string; name: string }

// Só assinantes premium ativos que não desligaram a preferência em Configurações
// (user_preferences.email_alerts_enabled, default true — é opt-out, não opt-in,
// porque é um benefício que a pessoa já paga por).
async function getRecipients(): Promise<Recipient[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return []
  const headers = { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }
  try {
    const subsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?status=eq.premium&expires_at=gte.${new Date().toISOString()}&select=user_id`,
      { headers }
    )
    if (!subsRes.ok) return []
    const subs = await subsRes.json() as { user_id: string }[]
    if (subs.length === 0) return []
    const userIds = [...new Set(subs.map(s => s.user_id))]

    const prefsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_preferences?user_id=in.(${userIds.join(',')})&select=user_id,email_alerts_enabled`,
      { headers }
    )
    const prefs = prefsRes.ok ? await prefsRes.json() as { user_id: string; email_alerts_enabled: boolean }[] : []
    const optedOut = new Set(prefs.filter(p => p.email_alerts_enabled === false).map(p => p.user_id))
    const eligibleIds = userIds.filter(id => !optedOut.has(id))
    if (eligibleIds.length === 0) return []

    // Percorre todas as páginas do admin de usuários — antes só lia a 1ª página
    // (per_page=500), então assinantes elegíveis cadastrados depois do 500º usuário
    // TOTAL do app (não só premium) nunca recebiam o alerta, sem erro nem log
    // (achado da auditoria de 22/ago/2026).
    const eligibleSet = new Set(eligibleIds)
    const found: Recipient[] = []
    const PER_PAGE = 500
    for (let page = 1; page <= 50 && found.length < eligibleSet.size; page++) {
      const usersRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=${PER_PAGE}&page=${page}`, { headers })
      if (!usersRes.ok) break
      const usersData = await usersRes.json() as { users?: { id: string; email?: string; user_metadata?: { full_name?: string } }[] }
      const users = usersData.users ?? []
      if (users.length === 0) break
      for (const u of users) {
        if (eligibleSet.has(u.id) && u.email) found.push({ email: u.email, name: u.user_metadata?.full_name ?? 'Surfista' })
      }
      if (users.length < PER_PAGE) break
    }
    return found
  } catch {
    return []
  }
}

function buildEmailHtml(name: string, bestSpot: SpotResult, allSpots: SpotResult[]): string {
  const firstName = name.split(' ')[0]
  const hourBRT = (new Date().getUTCHours() - 3 + 24) % 24
  const greeting = hourBRT < 12 ? 'Bom dia' : 'Boa tarde'

  const spotsRows = allSpots
    .filter(s => s.score >= 6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(s => `<tr>
      <td style="padding:10px 16px;border-bottom:1px solid #222;font-weight:500">${s.name}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #222;color:${s.score >= 8 ? '#22c55e' : s.score >= 7 ? '#0ea5e9' : '#f59e0b'};font-weight:700">${s.score}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #222;color:#999">${s.waveHeight}m · ${s.swellPeriod}s · ${s.windSpeed}km/h</td>
    </tr>`).join('')

  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#fff;border-radius:16px;overflow:hidden">
    <div style="padding:32px;background:linear-gradient(135deg,#0ea5e920,#6366f120);border-bottom:1px solid #222">
      <p style="margin:0 0 4px;font-size:13px;color:#0ea5e9;font-weight:600;letter-spacing:1px">ALERTA DE SURF · PREMIUM</p>
      <h1 style="margin:0;font-size:24px;font-weight:800">${greeting}, ${firstName}! O mar está bom 🌊</h1>
    </div>
    <div style="padding:32px">
      <div style="background:linear-gradient(135deg,#0ea5e915,#6366f115);border:1px solid #0ea5e940;border-radius:12px;padding:24px;margin-bottom:24px">
        <p style="margin:0 0 4px;font-size:12px;color:#0ea5e9;font-weight:600;letter-spacing:1px">MELHOR AGORA</p>
        <h2 style="margin:0 0 8px;font-size:22px">${bestSpot.name}</h2>
        <div>
          <span style="color:#ccc;font-size:14px;margin-right:16px">🌊 ${bestSpot.waveHeight}m</span>
          <span style="color:#ccc;font-size:14px;margin-right:16px">⏱ ${bestSpot.swellPeriod}s de período</span>
          <span style="color:#ccc;font-size:14px">💨 ${bestSpot.windSpeed}km/h ${bestSpot.windDirection}</span>
        </div>
      </div>
      ${spotsRows ? `<table style="width:100%;border-collapse:collapse;background:#111;border-radius:12px;overflow:hidden;margin-bottom:24px">
        <thead><tr style="background:#1a1a1a">
          <th style="padding:10px 16px;text-align:left;font-size:12px;color:#666;font-weight:600">PRAIA</th>
          <th style="padding:10px 16px;text-align:left;font-size:12px;color:#666;font-weight:600">SCORE</th>
          <th style="padding:10px 16px;text-align:left;font-size:12px;color:#666;font-weight:600">CONDIÇÕES</th>
        </tr></thead>
        <tbody>${spotsRows}</tbody>
      </table>` : ''}
      <a href="${APP_URL}" style="display:block;text-align:center;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;text-decoration:none;padding:16px 32px;border-radius:12px;font-weight:700;font-size:16px">Ver todas as praias</a>
    </div>
    <div style="padding:20px 32px;background:#111;text-align:center">
      <p style="margin:0 0 6px;font-size:12px;color:#555">Surf AI Floripa · Alerta exclusivo do plano Premium</p>
      <a href="${APP_URL}/settings" style="font-size:11px;color:#555;text-decoration:underline">Não quero mais receber esse alerta</a>
    </div>
  </div>`
}

async function sendAlertEmail(to: string, name: string, bestSpot: SpotResult, allSpots: SpotResult[]): Promise<boolean> {
  if (!RESEND_API_KEY) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Surf AI Floripa <alertas@alo.surfaifloripa.com.br>',
        to: [to],
        subject: `🌊 ${bestSpot.name} está com score ${bestSpot.score}, vai lá!`,
        html: buildEmailHtml(name, bestSpot, allSpots),
      }),
      signal: AbortSignal.timeout(10000),
    })
    return res.ok
  } catch {
    return false
  }
}

export default async function handler(req: Request) {
  const url = new URL(req.url)
  const secret = req.headers.get('x-agent-secret') ?? url.searchParams.get('secret')

  if (!AGENT_SECRET || secret !== AGENT_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const results = (await Promise.all(SPOTS.map(fetchSpotScore))).filter((r): r is SpotResult => r !== null)
  const goodSpots = results.filter(s => s.score >= SCORE_THRESHOLD)
  if (goodSpots.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'nenhuma praia com score suficiente' }), { headers: { 'Content-Type': 'application/json' } })
  }
  const bestSpot = goodSpots.sort((a, b) => b.score - a.score)[0]

  const recipients = await getRecipients()
  if (recipients.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'nenhum assinante premium elegível' }), { headers: { 'Content-Type': 'application/json' } })
  }

  let sent = 0
  for (const r of recipients) {
    const ok = await sendAlertEmail(r.email, r.name, bestSpot, results)
    if (ok) sent++
  }

  return new Response(JSON.stringify({ ok: true, bestSpot: bestSpot.name, score: bestSpot.score, eligible: recipients.length, sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
