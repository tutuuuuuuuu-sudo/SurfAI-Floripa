export const config = { runtime: 'edge' }
import { calculateSurfScore } from './_scoreEngine.js'

// Agente de Conteúdo Viral
// Gera legendas otimizadas para Instagram e TikTok baseadas nas condições reais do mar
// Pode ser chamado manualmente via POST ou agendado via cron

const APP_URL = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const AGENT_SECRET = process.env.AGENT_SECRET // proteção para chamadas externas

const SPOTS = [
  { id: 'campeche',    name: 'Campeche',       lat: -27.68, lng: -48.49, orientation: 90 },
  { id: 'joaquina',   name: 'Joaquina',        lat: -27.63, lng: -48.44, orientation: 90 },
  { id: 'mole',       name: 'Praia Mole',      lat: -27.60, lng: -48.44, orientation: 90 },
  { id: 'barra-lagoa',name: 'Barra da Lagoa',  lat: -27.57, lng: -48.43, orientation: 90 },
  { id: 'santinho',   name: 'Santinho',        lat: -27.51, lng: -48.39, orientation: 60 },
]

interface SpotData {
  name: string
  score: number
  waveHeight: number
  swellPeriod: number
  windSpeed: number
  windDirection: string
  waterTemperature: number | null
}

interface ContentResult {
  instagram: {
    caption: string
    hashtags: string
    fullPost: string
  }
  tiktok: {
    hook: string
    caption: string
    hashtags: string
    fullPost: string
  }
  whatsapp: { text: string }
  twitter: { text: string }
  bestSpot: SpotData
  generatedAt: string
}

async function fetchSpot(spot: typeof SPOTS[0]): Promise<SpotData | null> {
  try {
    const res = await fetch(
      `${APP_URL}/api/surf?lat=${spot.lat}&lng=${spot.lng}&orientation=${spot.orientation}`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return null
    const data = await res.json() as { waveHeight?: number; swellPeriod?: number; windSpeed?: number; windDirection?: string; waterTemperature?: number }

    // Extrai direção limpa (ex: "SE (Terral)" → "SE") para cálculo de score
    const rawDir = (data.windDirection ?? 'N').split('(')[0].split(/\s+/)[0].trim().toUpperCase()
    // Orientação padrão 90° (leste) para spots sem orientação definida no content-agent
    const score = calculateSurfScore(data.waveHeight ?? 0, data.windSpeed ?? 0, data.swellPeriod ?? 0, rawDir, spot.orientation)

    return {
      name: spot.name,
      score: Number(score.toFixed(1)),
      waveHeight: data.waveHeight ?? 0,
      swellPeriod: data.swellPeriod ?? 0,
      windSpeed: data.windSpeed ?? 0,
      windDirection: data.windDirection ?? 'N',
      waterTemperature: data.waterTemperature ?? null,
    }
  } catch {
    return null
  }
}

async function generateContent(spots: SpotData[], bestSpot: SpotData, tone: string): Promise<ContentResult | null> {
  if (!ANTHROPIC_KEY) return null

  const now = new Date()
  const hourBrasilia = (now.getUTCHours() - 3 + 24) % 24
  const period = hourBrasilia < 12 ? 'manhã' : hourBrasilia < 18 ? 'tarde' : 'noite'
  const dayOfWeek = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' }).format(now)

  const spotsContext = spots
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(s => `${s.name}: ondas ${s.waveHeight}m, período ${s.swellPeriod}s, vento ${s.windSpeed}km/h ${s.windDirection}, score ${s.score}/10`)
    .join('\n')

  const conditionLevel = bestSpot.score >= 8 ? 'ÉPICO' : bestSpot.score >= 7 ? 'muito bom' : bestSpot.score >= 6 ? 'bom' : 'razoável'

  const toneGuide = tone === 'informativo'
    ? 'Tom técnico e informativo: dados precisos, linguagem clara, confiável. Poucos emojis. Foco nos números.'
    : tone === 'minimalista'
    ? 'Tom minimalista: frases curtas, sem emojis em excesso, direto ao ponto. Menos é mais.'
    : 'Tom animado: empolgante, usa gírias de surf brasileiro (manda bem, mandou ver, ondão, etc.), emojis estratégicos.'

  const prompt = `Você é o social media manager do Surf AI Floripa, um app de IA para surfistas de Florianópolis, SC.

${toneGuide}

Condições do mar em Floripa agora (${period} de ${dayOfWeek}):
${spotsContext}

Melhor praia: ${bestSpot.name} — ondas ${bestSpot.waveHeight}m, período ${bestSpot.swellPeriod}s, vento ${bestSpot.windSpeed}km/h ${bestSpot.windDirection}, score ${bestSpot.score}/10, condição ${conditionLevel}
${bestSpot.waterTemperature ? `Temperatura da água: ${bestSpot.waterTemperature}°C` : ''}

Crie conteúdo para 4 plataformas:

**INSTAGRAM** — legenda de 2-3 parágrafos + call-to-action. Termine com pergunta para engajamento. Hashtags separadas.

**TIKTOK** — hook impactante (primeiros 2s), legenda curta (máx 150 chars), hashtags.

**WHATSAPP** — mensagem direta para status ou grupo de surfistas. Máx 200 chars. Sem hashtags. Inclui link surfaifloripa.com.br.

**TWITTER** — tweet direto com dados + call-to-action. Máx 270 chars incluindo hashtags.

Regras:
- Mencione praias específicas de Floripa
- Use "Surf AI Floripa" pelo menos uma vez
- Call-to-action: link na bio / surfaifloripa.com.br / baixa o app
- Não use tom corporativo

Responda APENAS em JSON:
{
  "instagram": { "caption": "...", "hashtags": "#..." },
  "tiktok": { "hook": "...", "caption": "...", "hashtags": "#..." },
  "whatsapp": { "text": "..." },
  "twitter": { "text": "..." }
}`

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
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) return null

    const data = await res.json() as { content?: { text?: string }[] }
    const raw = data.content?.[0]?.text ?? ''

    // Extrai JSON da resposta
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])

    return {
      instagram: {
        caption: parsed.instagram.caption,
        hashtags: parsed.instagram.hashtags,
        fullPost: `${parsed.instagram.caption}\n\n${parsed.instagram.hashtags}`,
      },
      tiktok: {
        hook: parsed.tiktok.hook,
        caption: parsed.tiktok.caption,
        hashtags: parsed.tiktok.hashtags,
        fullPost: `${parsed.tiktok.hook}\n\n${parsed.tiktok.caption}\n\n${parsed.tiktok.hashtags}`,
      },
      whatsapp: { text: parsed.whatsapp?.text ?? '' },
      twitter: { text: parsed.twitter?.text ?? '' },
      bestSpot,
      generatedAt: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

import { verifyPremiumToken } from './_auth.js'

// Rate limit por IP para chamadas de usuário: 20 req/hora
const contentRateLimit = new Map<string, { count: number; reset: number }>()
function checkContentRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = contentRateLimit.get(ip)
  if (!entry || now > entry.reset) {
    contentRateLimit.set(ip, { count: 1, reset: now + 3_600_000 })
    return true
  }
  if (entry.count >= 20) return false
  entry.count++
  return true
}

export default async function handler(req: Request) {
  // Crons internos do Vercel chegam como GET com header x-vercel-signature
  // Chamadas externas com AGENT_SECRET via x-agent-secret
  // Usuários premium via Bearer token JWT
  const agentSecret = req.headers.get('x-agent-secret')
  const authHeader = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  // Vercel injeta Authorization: Bearer <CRON_SECRET> automaticamente nos crons quando CRON_SECRET está configurado
  const isVercelCron = req.method === 'GET' && cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isVercelCron) {
    if (agentSecret) {
      if (!AGENT_SECRET || agentSecret !== AGENT_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    } else if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const isPremium = await verifyPremiumToken(token)
      if (!isPremium) {
        return new Response(JSON.stringify({ error: 'Premium required' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
      if (!checkContentRateLimit(ip)) {
        return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
        })
      }
    } else {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Busca condições de todas as praias em paralelo
  const results = (await Promise.all(SPOTS.map(fetchSpot))).filter(Boolean) as SpotData[]

  if (results.length === 0) {
    return new Response(JSON.stringify({ error: 'Não foi possível buscar condições do mar' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const bestSpot = results.sort((a, b) => b.score - a.score)[0]
  const tone = new URL(req.url).searchParams.get('tone') ?? 'animado'

  // Gera conteúdo via Claude
  const content = await generateContent(results, bestSpot, tone)

  if (!content) {
    return new Response(JSON.stringify({ error: 'Falha ao gerar conteúdo' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(content), {
    headers: { 'Content-Type': 'application/json' },
  })
}
