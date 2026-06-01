export const config = { runtime: 'edge' }
import { calculateSurfScore } from './_scoreEngine'

// Agente de Conteúdo Viral
// Gera legendas otimizadas para Instagram e TikTok baseadas nas condições reais do mar
// Pode ser chamado manualmente via POST ou agendado via cron

const APP_URL = process.env.APP_URL ?? 'https://surf-ai-floripa.vercel.app'
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

async function generateContent(spots: SpotData[], bestSpot: SpotData): Promise<ContentResult | null> {
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

  const prompt = `Você é o social media manager do Surf AI Floripa, um app de inteligência artificial para surfistas de Florianópolis, SC. Seu estilo é autêntico, animado, usa gírias de surf brasileiro e conecta com a comunidade local.

Condições do mar em Floripa agora (${period} de ${dayOfWeek}):
${spotsContext}

Melhor praia: ${bestSpot.name} — ondas ${bestSpot.waveHeight}m, período ${bestSpot.swellPeriod}s, vento ${bestSpot.windSpeed}km/h ${bestSpot.windDirection}, score ${bestSpot.score}/10, condição ${conditionLevel}
${bestSpot.waterTemperature ? `Temperatura da água: ${bestSpot.waterTemperature}°C` : ''}

Crie dois conteúdos virais:

**INSTAGRAM** — legenda engajante de 2-3 parágrafos curtos + call-to-action para baixar o app. Use emojis estrategicamente (não em excesso). Termine com uma pergunta para gerar comentários. Depois, numa linha separada, liste as hashtags (sem contar na legenda).

**TIKTOK** — primeiro o "hook" (primeira frase/gancho que aparece nos primeiros 2 segundos — deve ser impactante e gerar curiosidade). Depois a legenda curta (máx 150 caracteres). Depois as hashtags.

Regras:
- Mencione praias específicas de Floripa (não "praias de SC" genérico)
- Use o nome "Surf AI Floripa" pelo menos uma vez
- Call-to-action: link na bio / baixa o app
- Tom: surfista local que descobriu algo incrível, não corporativo
- Se condição for boa/épica: celebra. Se for razoável: foca no que tem de bom e no app como diferencial

Responda APENAS em JSON com este formato exato:
{
  "instagram": {
    "caption": "texto da legenda sem hashtags",
    "hashtags": "#hashtag1 #hashtag2 ..."
  },
  "tiktok": {
    "hook": "primeira frase gancho",
    "caption": "legenda curta",
    "hashtags": "#hashtag1 #hashtag2 ..."
  }
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
        max_tokens: 1024,
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
      bestSpot,
      generatedAt: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export default async function handler(req: Request) {
  // Crons internos do Vercel não enviam secret — permite chamadas GET sem body (cron)
  // Chamadas externas (GitHub Actions, Make.com) devem enviar x-agent-secret
  const isVercelCron = req.method === 'GET' && !req.headers.get('x-agent-secret')
  if (!isVercelCron) {
    const secret = req.headers.get('x-agent-secret') ?? new URL(req.url).searchParams.get('secret')
    if (AGENT_SECRET && secret !== AGENT_SECRET) {
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

  // Gera conteúdo via Claude
  const content = await generateContent(results, bestSpot)

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
