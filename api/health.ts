export const config = { runtime: 'edge' }

// Agente de saúde — roda automaticamente toda manhã às 6h (horário de Brasília)
// Testa todas as rotas críticas e envia relatório por email

interface TestResult {
  name: string
  ok: boolean
  detail: string
  ms: number
}

const APP_URL = process.env.APP_URL ?? 'https://surf-ai-floripa.vercel.app'

// ── Testes ────────────────────────────────────────────────────────────────────

async function testSurfAPI(): Promise<TestResult> {
  // Praia do Campeche: lat -27.68, lng -48.49, orientation 90
  const start = Date.now()
  try {
    const res = await fetch(`${APP_URL}/api/surf?lat=-27.68&lng=-48.49&orientation=90`, {
      signal: AbortSignal.timeout(10000),
    })
    const ms = Date.now() - start
    if (!res.ok) return { name: 'API de Surf', ok: false, detail: `Status ${res.status}`, ms }

    const data = await res.json() as any
    if (typeof data.waveHeight !== 'number') return { name: 'API de Surf', ok: false, detail: 'waveHeight ausente ou inválido', ms }
    if (typeof data.windSpeed !== 'number') return { name: 'API de Surf', ok: false, detail: 'windSpeed ausente ou inválido', ms }
    if (data.waveHeight < 0 || data.waveHeight > 15) return { name: 'API de Surf', ok: false, detail: `waveHeight fora do intervalo: ${data.waveHeight}m`, ms }

    return { name: 'API de Surf', ok: true, detail: `Ondas ${data.waveHeight}m · Vento ${data.windSpeed}km/h · ${data.windDirection}`, ms }
  } catch (e: any) {
    return { name: 'API de Surf', ok: false, detail: e?.message ?? 'Timeout ou erro de rede', ms: Date.now() - start }
  }
}

async function testOpenMeteo(): Promise<TestResult> {
  const start = Date.now()
  try {
    const res = await fetch(
      'https://marine-api.open-meteo.com/v1/marine?latitude=-27.68&longitude=-48.49&current=wave_height&length_unit=metric',
      { signal: AbortSignal.timeout(8000) }
    )
    const ms = Date.now() - start
    if (!res.ok) return { name: 'Open-Meteo (Marine)', ok: false, detail: `Status ${res.status}`, ms }
    const data = await res.json() as any
    if (data.error) return { name: 'Open-Meteo (Marine)', ok: false, detail: data.reason ?? 'Erro desconhecido', ms }
    return { name: 'Open-Meteo (Marine)', ok: true, detail: `Ondas ${data.current?.wave_height ?? '?'}m`, ms }
  } catch (e: any) {
    return { name: 'Open-Meteo (Marine)', ok: false, detail: e?.message ?? 'Timeout', ms: Date.now() - start }
  }
}

async function testSupabase(): Promise<TestResult> {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY
  const start = Date.now()

  if (!supabaseUrl || !supabaseKey) {
    return { name: 'Supabase', ok: false, detail: 'Variáveis de ambiente não configuradas', ms: 0 }
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/profiles?select=count&limit=1`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      signal: AbortSignal.timeout(8000),
    })
    const ms = Date.now() - start
    if (!res.ok) return { name: 'Supabase', ok: false, detail: `Status ${res.status}`, ms }
    return { name: 'Supabase', ok: true, detail: 'Banco de dados respondendo', ms }
  } catch (e: any) {
    return { name: 'Supabase', ok: false, detail: e?.message ?? 'Timeout', ms: Date.now() - start }
  }
}

async function testWindy(): Promise<TestResult> {
  const key = process.env.WINDY_API_KEY
  if (!key) return { name: 'Windy API', ok: true, detail: 'Chave não configurada — usando Open-Meteo como fallback', ms: 0 }

  const start = Date.now()
  try {
    const res = await fetch('https://api.windy.com/api/point-forecast/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: -27.68, lon: -48.49, model: 'gfsWave', parameters: ['swell1'], key }),
      signal: AbortSignal.timeout(8000),
    })
    const ms = Date.now() - start
    const data = await res.json() as any
    if (data.error) return { name: 'Windy API', ok: false, detail: data.message ?? 'Erro na API', ms }
    return { name: 'Windy API', ok: true, detail: 'Respondendo normalmente', ms }
  } catch (e: any) {
    return { name: 'Windy API', ok: false, detail: e?.message ?? 'Timeout', ms: Date.now() - start }
  }
}

async function testPaymentAPI(): Promise<TestResult> {
  const start = Date.now()
  try {
    // Chama com dados intencionalmente inválidos — espera 400, não 500
    const res = await fetch(`${APP_URL}/api/create-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'test', userEmail: 'invalido', plan: 'mensal' }),
      signal: AbortSignal.timeout(8000),
    })
    const ms = Date.now() - start
    // 400 = rota funcionando e validando. 500 = problema real.
    if (res.status === 500) return { name: 'API de Pagamento', ok: false, detail: 'Erro interno (500) — verificar logs', ms }
    return { name: 'API de Pagamento', ok: true, detail: `Rota ativa (status ${res.status})`, ms }
  } catch (e: any) {
    return { name: 'API de Pagamento', ok: false, detail: e?.message ?? 'Timeout', ms: Date.now() - start }
  }
}

// ── Email via Resend ───────────────────────────────────────────────────────────

async function sendReport(results: TestResult[]) {
  const resendKey = process.env.RESEND_API_KEY
  const reportEmail = process.env.REPORT_EMAIL ?? 'r2rgarraza@gmail.com'
  if (!resendKey) return

  const allOk = results.every(r => r.ok)
  const failed = results.filter(r => !r.ok)
  const date = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

  const rows = results.map(r => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0">${r.ok ? '✅' : '❌'}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-weight:500">${r.name}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#666">${r.detail}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#999;text-align:right">${r.ms > 0 ? `${r.ms}ms` : '—'}</td>
    </tr>
  `).join('')

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff">
      <div style="background:${allOk ? '#0ea5e9' : '#ef4444'};padding:24px 32px;border-radius:12px 12px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">
          ${allOk ? '✅ Tudo funcionando' : `⚠️ ${failed.length} problema${failed.length > 1 ? 's' : ''} detectado${failed.length > 1 ? 's' : ''}`}
        </h1>
        <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px">Surf AI Floripa · ${date} às ${time}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;background:#fff">
        <thead>
          <tr style="background:#f8f8f8">
            <th style="padding:10px 16px;text-align:left;font-size:12px;color:#999;font-weight:600">STATUS</th>
            <th style="padding:10px 16px;text-align:left;font-size:12px;color:#999;font-weight:600">SERVIÇO</th>
            <th style="padding:10px 16px;text-align:left;font-size:12px;color:#999;font-weight:600">DETALHE</th>
            <th style="padding:10px 16px;text-align:right;font-size:12px;color:#999;font-weight:600">TEMPO</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${!allOk ? `
      <div style="padding:20px 32px;background:#fff5f5;border-top:2px solid #ef4444">
        <p style="margin:0;font-size:14px;color:#c0392b;font-weight:500">Ação recomendada:</p>
        <ul style="margin:8px 0 0;padding-left:20px;color:#666;font-size:14px">
          ${failed.map(r => `<li><strong>${r.name}:</strong> ${r.detail}</li>`).join('')}
        </ul>
      </div>` : ''}
      <div style="padding:16px 32px;background:#f8f8f8;border-radius:0 0 12px 12px">
        <p style="margin:0;font-size:12px;color:#999">Agente de monitoramento automático · Surf AI Floripa</p>
      </div>
    </div>
  `

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: 'Surf AI Monitor <onboarding@resend.dev>',
      to: [reportEmail],
      subject: `${allOk ? '✅' : '❌'} Surf AI — Relatório diário ${date}`,
      html,
    }),
  })
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: Request) {
  const url = new URL(req.url)
  const secret = process.env.HEALTH_SECRET
  const provided = url.searchParams.get('secret') ?? req.headers.get('x-health-secret')

  if (secret && provided !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized', secret_defined: !!secret }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  const results = await Promise.all([
    testSurfAPI(),
    testOpenMeteo(),
    testSupabase(),
    testWindy(),
    testPaymentAPI(),
  ])

  await sendReport(results)

  const allOk = results.every(r => r.ok)
  return new Response(JSON.stringify({ ok: allOk, results }), {
    status: allOk ? 200 : 207,
    headers: { 'Content-Type': 'application/json' },
  })
}
