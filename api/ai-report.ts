export const config = { runtime: 'edge' }

interface SpotSummary { name: string; score: number; waveHeight: number; windSpeed: number; windDirection: string; swellPeriod: number }
interface ReportBody { spots?: SpotSummary[]; topSpot?: SpotSummary; userLevel?: string }

const ALLOWED_ORIGIN = process.env.APP_URL ?? 'https://surf-ai-floripa.vercel.app'

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

interface AuthResult {
  valid: boolean
  userId: string | null
}

// Valida o token JWT e retorna o userId — uma única chamada para ambos os checks
async function verifyToken(token: string): Promise<AuthResult> {
  const supabaseUrl = process.env.SUPABASE_URL
  // SUPABASE_ANON_KEY é a chave pública do backend (distinta de VITE_SUPABASE_ANON_KEY do frontend)
  // Fallback para a service key — ambas funcionam como apikey no endpoint /auth/v1/user
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseAnonKey) return { valid: false, userId: null }
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseAnonKey },
    })
    if (!res.ok) return { valid: false, userId: null }
    const user = await res.json() as { id?: string }
    return { valid: true, userId: user.id ?? null }
  } catch {
    return { valid: false, userId: null }
  }
}

// Verifica se o userId tem assinatura premium ativa no Supabase
async function isPremiumUser(userId: string): Promise<boolean> {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return false
  try {
    const now = new Date().toISOString()
    const res = await fetch(
      `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}&status=eq.premium&expires_at=gte.${now}&select=id&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    )
    if (!res.ok) return false
    const rows = await res.json() as { id: string }[]
    return Array.isArray(rows) && rows.length > 0
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

  // Requer autenticação — só usuários logados e com plano premium podem gerar relatórios
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '').trim()
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
    })
  }

  const { valid, userId } = await verifyToken(token)
  if (!valid || !userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
    })
  }

  // Relatório de IA consome créditos da Anthropic — restrito a usuários premium
  const premium = await isPremiumUser(userId)
  if (!premium) {
    return new Response(JSON.stringify({ error: 'Premium required', code: 'NOT_PREMIUM' }), {
      status: 403,
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

  const sanitizeName  = (v: unknown) => String(v ?? '').slice(0, 50).replace(/[^\w\s\-áéíóúàâêôãõçÁÉÍÓÚÀÂÊÔÃÕÇ]/g, '')
  const sanitizeNum   = (v: unknown, min: number, max: number) => Math.max(min, Math.min(max, Number(v) || 0))
  const sanitizeDir   = (v: unknown) => String(v ?? '').slice(0, 20).replace(/[^a-zA-Z ()]/g, '')
  const sanitizeLevel = (v: unknown) => String(v ?? '').slice(0, 30).replace(/[^\w\s]/g, '')

  const spotsContext = (spots ?? []).slice(0, 5).map(s => {
    const name   = sanitizeName(s.name)
    const score  = sanitizeNum(s.score, 0, 10)
    const wave   = sanitizeNum(s.waveHeight, 0, 20)
    const wind   = sanitizeNum(s.windSpeed, 0, 200)
    const dir    = sanitizeDir(s.windDirection)
    const period = sanitizeNum(s.swellPeriod, 0, 30)
    return `${name}: score ${score.toFixed(1)}, ondas ${wave.toFixed(1)}m, vento ${wind}km/h ${dir}, período ${period}s`
  }).join('\n')

  const topName   = sanitizeName(topSpot.name)
  const topScore  = sanitizeNum(topSpot.score, 0, 10)
  const topWave   = sanitizeNum(topSpot.waveHeight, 0, 20)
  const topPeriod = sanitizeNum(topSpot.swellPeriod, 0, 30)
  const topWind   = sanitizeNum(topSpot.windSpeed, 0, 200)
  const topDir    = sanitizeDir(topSpot.windDirection)
  const safeLevel = userLevel ? sanitizeLevel(userLevel) : ''

  const prompt = `Você é um analista de surf experiente de Florianópolis, SC. Escreva um relatório de surf diário em português brasileiro, informal e direto, para ${safeLevel ? `surfistas de nível ${safeLevel}` : 'todos os níveis'}.

Dados das condições atuais das praias de Floripa:
${spotsContext}

Melhor praia agora: ${topName} (score ${topScore.toFixed(1)}/10, ondas ${topWave.toFixed(1)}m, período ${topPeriod}s, vento ${topWind}km/h ${topDir})

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

    const data = await response.json() as { content?: { text?: string }[] }
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
