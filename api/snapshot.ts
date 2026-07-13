export const config = { runtime: 'edge' }

import { calculateSurfScore } from './_scoreEngine.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const APP_URL = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'

const BEACHES = [
  { id: 'campeche',      name: 'Campeche',          lat: -27.6977, lng: -48.4899, orientation: 90  },
  { id: 'novo-campeche', name: 'Novo Campeche',      lat: -27.6661, lng: -48.4755, orientation: 90  },
  { id: 'morro-pedras',  name: 'Morro das Pedras',   lat: -27.7171, lng: -48.5034, orientation: 100 },
  { id: 'matadeiro',     name: 'Matadeiro',           lat: -27.7548, lng: -48.4986, orientation: 110 },
  { id: 'lagoinha-leste',name: 'Lagoinha do Leste',  lat: -27.7732, lng: -48.4864, orientation: 180 },
  { id: 'acores',        name: 'Açores',              lat: -27.7837, lng: -48.5237, orientation: 120 },
  { id: 'solidao',       name: 'Solidão',             lat: -27.7941, lng: -48.5335, orientation: 130 },
  { id: 'armacao',       name: 'Armação',             lat: -27.7504, lng: -48.5018, orientation: 115 },
  { id: 'naufragados',   name: 'Naufragados',         lat: -27.8336, lng: -48.5642, orientation: 180 },
  { id: 'joaquina',      name: 'Joaquina',            lat: -27.6294, lng: -48.4490, orientation: 90  },
  { id: 'mole',          name: 'Praia Mole',          lat: -27.6022, lng: -48.4327, orientation: 85  },
  { id: 'mocambique',    name: 'Moçambique',          lat: -27.4938, lng: -48.3955, orientation: 80  },
  { id: 'barra-lagoa',   name: 'Barra da Lagoa',      lat: -27.5735, lng: -48.4249, orientation: 75  },
  { id: 'santinho',      name: 'Santinho',            lat: -27.4619, lng: -48.3762, orientation: 70  },
  { id: 'ponta-aranhas', name: 'Ponta das Aranhas',   lat: -27.4802, lng: -48.3770, orientation: 65  },
]

const WIND_DIR_MAP: Record<string, number> = {
  N:0,NNE:22.5,NE:45,ENE:67.5,E:90,ESE:112.5,SE:135,SSE:157.5,
  S:180,SSW:202.5,SW:225,WSW:247.5,W:270,WNW:292.5,NW:315,NNW:337.5
}

async function fetchSurf(lat: number, lng: number, orientation: number) {
  const res = await fetch(
    `${APP_URL}/api/surf?lat=${lat}&lng=${lng}&orientation=${orientation}`,
    { signal: AbortSignal.timeout(12000) }
  )
  if (!res.ok) return null
  return res.json() as Promise<{
    waveHeight?: number; windSpeed?: number; windDirection?: string; swellPeriod?: number
  }>
}

export default async function handler(req: Request) {
  // Cron roda via GitHub Actions (ver .github/workflows/snapshot.yml), autenticado por secret em query param
  const secret = process.env.SNAPSHOT_SECRET
  const provided = new URL(req.url).searchParams.get('secret')
  if (!secret || provided !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({ error: 'Supabase não configurado' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  const rows: {
    beach_id: string; beach_name: string; score: number
    wave_height: number; wind_speed: number; swell_period: number; wind_direction: string
  }[] = []

  // Processa em lotes de 5 para não sobrecarregar
  const BATCH = 5
  for (let i = 0; i < BEACHES.length; i += BATCH) {
    const batch = BEACHES.slice(i, i + BATCH)
    const results = await Promise.allSettled(
      batch.map(async beach => {
        const data = await fetchSurf(beach.lat, beach.lng, beach.orientation)
        if (!data) return null
        const waveHeight = Number((data.waveHeight ?? 1.0).toFixed(2))
        const windSpeed = Math.round(data.windSpeed ?? 12)
        const swellPeriod = Math.round(data.swellPeriod ?? 10)
        const rawDir = (data.windDirection ?? 'N').split('(')[0].trim().toUpperCase()
        const windDirection = WIND_DIR_MAP[rawDir] !== undefined ? rawDir : 'N'
        const score = calculateSurfScore(waveHeight, windSpeed, swellPeriod, windDirection, beach.orientation)
        return { beach_id: beach.id, beach_name: beach.name, score, wave_height: waveHeight, wind_speed: windSpeed, swell_period: swellPeriod, wind_direction: windDirection }
      })
    )
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) rows.push(r.value)
    }
  }

  if (rows.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: 'Sem dados' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  // Insere no Supabase usando service role
  const res = await fetch(`${SUPABASE_URL}/rest/v1/score_snapshots`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  })

  if (!res.ok) {
    const err = await res.text()
    return new Response(JSON.stringify({ ok: false, error: err }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  // Limpa snapshots com mais de 30 dias para não inflar o banco
  await fetch(`${SUPABASE_URL}/rest/v1/score_snapshots?captured_at=lt.${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  })

  return new Response(JSON.stringify({ ok: true, saved: rows.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
