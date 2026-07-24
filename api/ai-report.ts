export const config = { runtime: 'edge' }

interface SpotSummary { name: string; score: number; waveHeight: number; windSpeed: number; windDirection: string; swellPeriod: number }
interface ReportBody { spots?: SpotSummary[]; topSpot?: SpotSummary; userLevel?: string }

const ALLOWED_ORIGIN = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

import { verifyToken, isPremiumUser } from './_auth.js'

// Rate limit por userId: 10 chamadas por hora (relatório custa créditos Anthropic)
const aiRateLimit = new Map<string, { count: number; reset: number }>()
function checkAiRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = aiRateLimit.get(userId)
  if (!entry || now > entry.reset) {
    aiRateLimit.set(userId, { count: 1, reset: now + 3_600_000 })
    return true
  }
  if (entry.count >= 10) return false
  entry.count++
  return true
}

// Detecta tentativas de prompt injection nos campos de texto
function hasPromptInjection(value: string): boolean {
  const lower = value.toLowerCase()
  return (
    lower.includes('ignore') ||
    lower.includes('esquece') ||
    lower.includes('system:') ||
    lower.includes('assistant:') ||
    lower.includes('instrução') ||
    lower.includes('instrucao') ||
    lower.includes('prompt') ||
    lower.includes('<|') ||
    lower.includes('|>')
  )
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

  // Rate limit: 10 relatórios por usuário por hora
  if (!checkAiRateLimit(userId)) {
    return new Response(JSON.stringify({ error: 'Limite de relatórios atingido. Tente novamente em 1 hora.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN, 'Retry-After': '3600' },
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

  // Bloqueia prompt injection nos campos de texto livre
  if (hasPromptInjection(String(userLevel ?? '')) || hasPromptInjection(String(topSpot.name ?? ''))) {
    return new Response(JSON.stringify({ error: 'Input inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
    })
  }

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

  const prompt = `Você é um analista de surf experiente de Florianópolis, SC, escrevendo para um app que já mostra pro usuário, na mesma tela, o nome e o score da melhor praia agora. NÃO repita essa informação óbvia — o valor do seu relatório é o que só um analista humano perceberia, não o placar.

Dados das condições atuais das praias de Floripa:
${spotsContext}

Melhor praia agora (já visível na tela do usuário, não repita isso): ${topName} (score ${topScore.toFixed(1)}/10, ondas ${topWave.toFixed(1)}m, período ${topPeriod}s, vento ${topWind}km/h ${topDir})

Escreva um relatório de 3-4 frases em português brasileiro, informal e direto, para ${safeLevel ? `surfistas de nível ${safeLevel}` : 'todos os níveis'}, que:
1. Comece com uma frase de impacto comparando praias (ex: por que uma praia específica está melhor que as outras agora, ou um contraste claro entre duas opções) — nunca comece reafirmando o placar da melhor praia
2. Aponte uma tendência ou risco que não dá pra ver só olhando o número: piora/melhora esperada ao longo do dia, janela de horário mais curta que o normal, praia alternativa pra quem não conseguir ir na primeira opção
3. Feche com uma dica prática e específica de segurança ou tática (não genérica) para quem vai surfar hoje
4. Use linguagem de surfista brasileiro, seja animado se as condições estiverem boas

Não inclua emojis. Não repita ondas/período/vento em números exatos (o usuário já vê isso na tela). Responda APENAS o texto do relatório, sem títulos ou formatação.`

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
      signal: AbortSignal.timeout(15000),
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
