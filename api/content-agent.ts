export const config = { runtime: 'edge' }
import { calculateSurfScore } from './_scoreEngine.js'
import { callGemini } from './_gemini.js'
import { createPersistentRateLimiter } from './_httpUtils.js'
import { getBeaches } from './_beachRegistry.js'

// Agente de Conteúdo Viral
// Gera legendas otimizadas para Instagram e TikTok baseadas nas condições reais do mar
// Pode ser chamado manualmente via POST ou agendado via cron

const APP_URL = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'
const GEMINI_KEY = process.env.GEMINI_API_KEY
const AGENT_SECRET = process.env.AGENT_SECRET // proteção para chamadas externas

const SPOTS = getBeaches(['campeche', 'joaquina', 'mole', 'barra-lagoa', 'santinho'])

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

    const rawDir = (data.windDirection ?? 'N').toUpperCase()
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
  if (!GEMINI_KEY) return null

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
    // Mesma folga extra de ai-report.ts pro raciocínio interno do gemini-3.6-flash —
    // aqui a resposta já era mais longa (JSON com 4 variantes de post) então precisa de
    // mais espaço ainda pra não cortar no meio do JSON e quebrar o JSON.parse abaixo.
    const result = await callGemini(GEMINI_KEY, prompt, 6000)
    if (!result.ok) return null
    const raw = result.text

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

import { verifyAdminToken } from './_auth.js'

// Rate limit por IP para chamadas de usuário: 20 req/hora. Persistido no Postgres —
// endpoint admin que custa créditos de API do Gemini, precisa valer mesmo com várias
// instâncias serverless rodando em paralelo.
const checkContentRateLimit = createPersistentRateLimiter('content-agent', 20, 3_600_000)

export default async function handler(req: Request) {
  // Cron roda via GitHub Actions (ver .github/workflows/content-agent.yml) com AGENT_SECRET via x-agent-secret
  // Ferramenta de uso interno (não é benefício de assinante) — só admin autentica via Bearer token JWT
  const agentSecret = req.headers.get('x-agent-secret')
  const authHeader = req.headers.get('Authorization')

  if (agentSecret) {
    if (!AGENT_SECRET || agentSecret !== AGENT_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } else if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const isAdmin = await verifyAdminToken(token)
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    if (!(await checkContentRateLimit(ip))) {
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

  if (!GEMINI_KEY) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY não configurada' }), {
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

  // Gera conteúdo via Gemini
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
