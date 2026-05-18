export const config = { runtime: 'edge' }

// Roda 2x por dia (6h e 18h) via cron
// Busca as condições do mar e envia alerta para todos os usuários
// quando alguma praia tiver score alto

const RESEND_KEY = process.env.RESEND_API_KEY
const APP_URL = process.env.APP_URL ?? 'https://surf-ai-floripa.vercel.app'
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const SCORE_THRESHOLD = 7.5 // só envia se alguma praia tiver score >= 7.5

interface SpotResult {
  name: string
  score: number
  waveHeight: number
  windSpeed: number
  windDirection: string
  swellPeriod: number
}

// Praias principais para checar (id, nome, lat, lng, orientação)
const SPOTS = [
  { id: 'campeche', name: 'Campeche', lat: -27.68, lng: -48.49, orientation: 90 },
  { id: 'joaquina', name: 'Joaquina', lat: -27.63, lng: -48.44, orientation: 90 },
  { id: 'mole', name: 'Praia Mole', lat: -27.60, lng: -48.44, orientation: 90 },
  { id: 'barra-lagoa', name: 'Barra da Lagoa', lat: -27.57, lng: -48.43, orientation: 90 },
  { id: 'santinho', name: 'Santinho', lat: -27.51, lng: -48.39, orientation: 60 },
]

async function fetchSpotScore(spot: typeof SPOTS[0]): Promise<SpotResult | null> {
  try {
    const res = await fetch(
      `${APP_URL}/api/surf?lat=${spot.lat}&lng=${spot.lng}&orientation=${spot.orientation}`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return null
    const data = await res.json() as any

    // Score simples: baseado em altura de onda e período
    const waveScore = Math.min(data.waveHeight / 2, 1) * 40       // até 40 pts
    const periodScore = Math.min(data.swellPeriod / 14, 1) * 30   // até 30 pts
    const windPenalty = data.windSpeed > 20 ? -15 : data.windSpeed > 15 ? -8 : 0
    const isTermal = (data.windDirection ?? '').includes('Terral') ? 10 : 0
    const score = Math.max(0, Math.min(10, (waveScore + periodScore + windPenalty + isTermal) / 8))

    return {
      name: spot.name,
      score: Number(score.toFixed(1)),
      waveHeight: data.waveHeight,
      windSpeed: data.windSpeed,
      windDirection: data.windDirection,
      swellPeriod: data.swellPeriod,
    }
  } catch {
    return null
  }
}

async function getUserEmails(): Promise<{ email: string; name: string }[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return []
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=500`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    })
    if (!res.ok) return []
    const data = await res.json() as any
    return (data.users ?? []).map((u: any) => ({
      email: u.email,
      name: u.user_metadata?.full_name ?? 'Surfista',
    }))
  } catch {
    return []
  }
}

async function sendAlertEmail(to: string, name: string, bestSpot: SpotResult, allSpots: SpotResult[]) {
  if (!RESEND_KEY) return false
  const firstName = name.split(' ')[0]
  const hour = new Date().getUTCHours()
  const isMorning = hour < 14
  const greeting = isMorning ? 'Bom dia' : 'Boa tarde'

  const spotsRows = allSpots
    .filter(s => s.score >= 6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(s => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #222;font-weight:500">${s.name}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #222;color:${s.score >= 8 ? '#22c55e' : s.score >= 7 ? '#0ea5e9' : '#f59e0b'};font-weight:700">${s.score}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #222;color:#999">${s.waveHeight}m · ${s.swellPeriod}s · ${s.windSpeed}km/h</td>
      </tr>
    `).join('')

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#fff;border-radius:16px;overflow:hidden">

      <div style="padding:32px;background:linear-gradient(135deg,#0ea5e920,#6366f120);border-bottom:1px solid #222">
        <p style="margin:0 0 4px;font-size:13px;color:#0ea5e9;font-weight:600;letter-spacing:1px">ALERTA DE SURF</p>
        <h1 style="margin:0;font-size:24px;font-weight:800">${greeting}, ${firstName}! O mar está bom 🌊</h1>
      </div>

      <div style="padding:32px">
        <div style="background:linear-gradient(135deg,#0ea5e915,#6366f115);border:1px solid #0ea5e940;border-radius:12px;padding:24px;margin-bottom:24px">
          <p style="margin:0 0 4px;font-size:12px;color:#0ea5e9;font-weight:600;letter-spacing:1px">MELHOR AGORA</p>
          <h2 style="margin:0 0 8px;font-size:22px">${bestSpot.name}</h2>
          <div style="display:flex;gap:16px;flex-wrap:wrap">
            <span style="color:#ccc;font-size:14px">🌊 ${bestSpot.waveHeight}m</span>
            <span style="color:#ccc;font-size:14px">⏱ ${bestSpot.swellPeriod}s de período</span>
            <span style="color:#ccc;font-size:14px">💨 ${bestSpot.windSpeed}km/h ${bestSpot.windDirection}</span>
          </div>
        </div>

        ${spotsRows ? `
        <table style="width:100%;border-collapse:collapse;background:#111;border-radius:12px;overflow:hidden;margin-bottom:24px">
          <thead>
            <tr style="background:#1a1a1a">
              <th style="padding:10px 16px;text-align:left;font-size:12px;color:#666;font-weight:600">PRAIA</th>
              <th style="padding:10px 16px;text-align:left;font-size:12px;color:#666;font-weight:600">SCORE</th>
              <th style="padding:10px 16px;text-align:left;font-size:12px;color:#666;font-weight:600">CONDIÇÕES</th>
            </tr>
          </thead>
          <tbody>${spotsRows}</tbody>
        </table>` : ''}

        <a href="${APP_URL}"
           style="display:block;text-align:center;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;text-decoration:none;padding:16px 32px;border-radius:12px;font-weight:700;font-size:16px">
          Ver todas as praias
        </a>
      </div>

      <div style="padding:20px 32px;background:#111;text-align:center">
        <p style="margin:0;font-size:12px;color:#555">
          Surf AI Floripa · Você recebe esse alerta quando o mar está bom
        </p>
      </div>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({
      from: 'Surf AI Floripa <oi@surfaifloripa.com.br>',
      to: [to],
      subject: `🌊 ${bestSpot.name} está com score ${bestSpot.score} — vai lá!`,
      html,
    }),
  })
  return res.ok
}

export default async function handler(req: Request) {
  if (!RESEND_KEY) return new Response('RESEND_API_KEY não configurada', { status: 500 })

  // Busca condições de todas as praias em paralelo
  const results = (await Promise.all(SPOTS.map(fetchSpotScore))).filter(Boolean) as SpotResult[]
  const goodSpots = results.filter(s => s.score >= SCORE_THRESHOLD)

  // Só envia email se tiver alguma praia boa
  if (goodSpots.length === 0) {
    return new Response(JSON.stringify({ sent: false, reason: 'Nenhuma praia com score suficiente', scores: results }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const bestSpot = goodSpots.sort((a, b) => b.score - a.score)[0]
  const users = await getUserEmails()

  if (users.length === 0) {
    return new Response(JSON.stringify({ sent: false, reason: 'Nenhum usuário encontrado' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Envia para todos os usuários (em paralelo, máximo 10 por vez)
  let sent = 0
  for (let i = 0; i < users.length; i += 10) {
    const batch = users.slice(i, i + 10)
    await Promise.all(batch.map(u => sendAlertEmail(u.email, u.name, bestSpot, results).then(ok => { if (ok) sent++ })))
  }

  return new Response(JSON.stringify({ sent, users: users.length, bestSpot: bestSpot.name, score: bestSpot.score }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
