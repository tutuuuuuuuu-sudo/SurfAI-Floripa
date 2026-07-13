export const config = { runtime: 'edge' }

// Serve HTML com meta tags dinâmicas (Open Graph/Twitter) para crawlers de bots
// (Google, WhatsApp, Instagram, Facebook) quando acessam /spot/:id — que
// normalmente é uma rota client-side e sempre mostraria o título genérico do app.
// Usuários reais continuam recebendo a SPA normalmente (ver rewrite condicional no vercel.json).

import { calculateSurfScore } from './_scoreEngine.js'

const APP_URL = 'https://www.surfaifloripa.com.br'

// Picos vitrine liberados sem login — mesma lista de PUBLIC_SPOT_IDS em src/lib/surfData.ts.
// Coordenadas e orientação replicadas do array BEACHES (não alterar sem confirmação do usuário).
const SPOTS: Record<string, { name: string; region: string; lat: number; lng: number; orientation: number }> = {
  joaquina: { name: 'Joaquina', region: 'Leste', lat: -27.6293577, lng: -48.4490173, orientation: 90 },
  mole: { name: 'Praia Mole', region: 'Leste', lat: -27.6022459, lng: -48.4326839, orientation: 85 },
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function renderHtml(opts: { title: string; description: string; url: string }): string {
  const { title, description, url } = opts
  const t = escapeHtml(title)
  const d = escapeHtml(description)
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${url}" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${APP_URL}/icon-512.png" />
<meta property="og:locale" content="pt_BR" />
<meta property="og:site_name" content="Surf AI Floripa" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${APP_URL}/icon-512.png" />
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
<a href="${url}">Ver condições ao vivo em Surf AI Floripa</a>
</body>
</html>`
}

export default async function handler(req: Request) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id') ?? ''
  const spot = SPOTS[id]
  const pageUrl = `${APP_URL}/spot/${id}`

  if (!spot) {
    return new Response(renderHtml({
      title: 'Surf AI Floripa — Score de IA para as praias de Floripa',
      description: 'Saiba em segundos qual praia está melhor agora em Florianópolis.',
      url: `${APP_URL}/`,
    }), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  let title = `${spot.name} — Surf AI Floripa`
  let description = `Confira agora as condições de surf em ${spot.name}, ${spot.region} da Ilha. Score de IA, ondas, vento e maré em tempo real.`

  try {
    const res = await fetch(
      `${APP_URL}/api/surf?lat=${spot.lat}&lng=${spot.lng}&orientation=${spot.orientation}`,
      { signal: AbortSignal.timeout(6000) }
    )
    if (res.ok) {
      const data = await res.json() as {
        waveHeight?: number; swellPeriod?: number; windSpeed?: number; windDirection?: string
      }
      if (typeof data.waveHeight === 'number' && typeof data.windSpeed === 'number' && data.windDirection) {
        const windDir = data.windDirection.split(' ')[0]
        const score = calculateSurfScore(
          data.waveHeight,
          data.windSpeed,
          data.swellPeriod ?? 8,
          windDir,
          spot.orientation
        )
        const label = score >= 8.5 ? 'ÉPICO' : score >= 7 ? 'EXCELENTE' : score >= 5.5 ? 'BOM' : score >= 4 ? 'REGULAR' : 'RUIM'
        title = `${spot.name} — ${label} (${score.toFixed(1)}/10) agora | Surf AI Floripa`
        description = `${spot.name} está ${label} agora: ondas de ${data.waveHeight.toFixed(1)}m, vento ${Math.round(data.windSpeed)}km/h. Score de IA em tempo real para ${spot.region} da Ilha.`
      }
    }
  } catch {
    // Mantém título/descrição genéricos do pico se a fonte de dados falhar
  }

  return new Response(renderHtml({ title, description, url: pageUrl }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=300' },
  })
}
