export const config = { runtime: 'edge' }

interface SpotSummary { name: string; score: number; waveHeight: number; windSpeed: number; windDirection: string; swellPeriod: number }
interface ReportBody { spots?: SpotSummary[]; topSpot?: SpotSummary; userLevel?: string }

const ALLOWED_ORIGIN = process.env.APP_URL ?? 'https://surf-ai-floripa.vercel.app'

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Verifica se o token JWT do Supabase é válido consultando o endpoint /auth/v1/user
async function verifySupabaseToken(token: string): Promise<boolean> {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return false
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseAnonKey },
    })
    return res.ok
  } catch {
    return false
  }
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  // Requer autenticação — só usuários logados podem gerar relatórios
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '').trim()
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
    })
  }
  const isValid = await verifySupabaseToken(token)
  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
    })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
    })
  }

  let body: ReportBody
  try {
    body = await req.json() as ReportBody
  } catch {
    return new Response(JSON.stringify({ error: 'Body inválido' }), { status: 400 })
  }

  const { spots, topSpot, userLevel } = body

  if (!topSpot?.name) {
    return new Response(JSON.stringify({ error: 'Dados insuficientes' }), { status: 400 })
  }

  const spotsContext = (spots ?? []).slice(0, 5).map(s =>
    `${s.name}: score ${s.score}, ondas ${s.waveHeight}m, vento ${s.windSpeed}km/h ${s.windDirection}, período ${s.swellPeriod}s`
  ).join('\n')

  const prompt = `Você é um analista de surf experiente de Florianópolis, SC. Escreva um relatório de surf diário em português brasileiro, informal e direto, para ${userLevel ? `surfistas de nível ${userLevel}` : 'todos os níveis'}.

Dados das condições atuais das praias de Floripa:
${spotsContext}

Melhor praia agora: ${topSpot.name} (score ${topSpot.score}/10, ondas ${topSpot.waveHeight}m, período ${topSpot.swellPeriod}s, vento ${topSpot.windSpeed}km/h ${topSpot.windDirection})

Escreva um relatório de 3-4 frases que:
1. Diga como está o mar hoje em geral em Floripa
2. Recomende a melhor praia e por quê
3. Dê uma dica prática para quem vai surfar hoje
4. Use linguagem de surfista brasileiro, seja animado se as condições estiverem boas

Não inclua emojis. Responda APENAS o texto do relatório, sem títulos ou formatação.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[ai-report] Anthropic error:', err)
      return new Response(JSON.stringify({ error: 'Falha ao gerar relatório' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      })
    }

    const data = await response.json() as any
    const report = data.content?.[0]?.text ?? ''

    return new Response(JSON.stringify({ report }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
    })
  } catch (error) {
    console.error('[ai-report] erro:', error)
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
    })
  }
}
