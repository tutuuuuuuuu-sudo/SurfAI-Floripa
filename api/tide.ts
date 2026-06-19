export const config = { runtime: 'edge' }

const ALLOWED_ORIGIN = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Temperatura sazonal de fallback calibrada para Florianópolis (jan-dez)
const SEASONAL_TEMP = [25, 25, 24, 22, 21, 20, 19, 18, 19, 20, 22, 24]

async function fetchWaterTemp(): Promise<number> {
  // Fonte 1: NOAA ERDDAP — SST satélite
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const url = `https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplMURSST41.json?analysed_sst[${yesterday}T09:00:00Z][(-27.62)][(-48.48)]`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = await res.json() as { table?: { rows?: [string, string, string, number][] } }
      const sst = data?.table?.rows?.[0]?.[3]
      if (typeof sst === 'number' && sst >= 15 && sst <= 30) return Math.round(sst)
    }
  } catch { /* tenta próxima */ }

  // Fonte 2: Open-Meteo Marine SST
  try {
    const res = await fetch(
      'https://marine-api.open-meteo.com/v1/marine?latitude=-27.62&longitude=-48.48&current=sea_surface_temperature&models=meteofrance_wave',
      { signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) {
      const data = await res.json() as { current?: { sea_surface_temperature?: number } }
      const sst = data.current?.sea_surface_temperature
      if (sst != null && sst >= 15 && sst <= 30) return Math.round(sst)
    }
  } catch { /* fallback */ }

  return SEASONAL_TEMP[new Date().getMonth()]
}

async function fetchTideData(): Promise<{ heights: number[]; times: string[] } | null> {
  try {
    const res = await fetch(
      'https://marine-api.open-meteo.com/v1/marine?' +
      'latitude=-27.62&longitude=-48.48' +
      '&hourly=sea_level_height_msl' +
      '&timezone=America%2FSao_Paulo&forecast_days=2',
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const data = await res.json() as {
      error?: string
      hourly?: { sea_level_height_msl: number[]; time: string[] }
    }
    if (data.error || !data.hourly?.sea_level_height_msl) return null
    return { heights: data.hourly.sea_level_height_msl, times: data.hourly.time }
  } catch { return null }
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  const url = new URL(req.url)
  const type = url.searchParams.get('type') ?? 'tide'

  if (type === 'temp') {
    const temp = await fetchWaterTemp()
    return new Response(JSON.stringify({ temp }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  // type === 'tide' (padrão)
  const tide = await fetchTideData()
  if (!tide) {
    return new Response(JSON.stringify({ error: 'Dados de maré indisponíveis' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  return new Response(JSON.stringify(tide), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
