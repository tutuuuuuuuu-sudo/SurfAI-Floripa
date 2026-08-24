// Cascata de fontes de condição de surf em tempo real — fonte única usada por surf.ts (nota
// principal exibida na Home/SpotDetails) e por hourly.ts (pra alinhar o slot "agora" da
// Melhor Janela do Dia com a MESMA fonte, não uma leitura de modelo diferente).
// Prefixo _ indica que não é um handler HTTP — não será exposto como endpoint pelo Vercel.

const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

function degToDir(deg: number): string {
  return DIRS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]
}

function nearestIndexForMs(targetMs: number, ts: number[]): number {
  let best = 0, bestDiff = Infinity
  ts.forEach((t, i) => {
    const diff = Math.abs((t > 1e11 ? t : t * 1000) - targetMs)
    if (diff < bestDiff) { bestDiff = diff; best = i }
  })
  return best
}

function nearestTsIndex(ts: number[]): number {
  return nearestIndexForMs(Date.now(), ts)
}

export interface LiveConditions {
  waveHeight: number
  swellPeriod: number
  swellDirection: string
  windSpeed: number
  windDir: string
  waterTemperature: number | null
  sunrise?: string
  sunset?: string
}

interface WindyRaw {
  ts: number[]
  windTs: number[]
  waveData: Record<string, unknown>
  windData: Record<string, unknown>
}

// Chamada crua à Windy, compartilhada entre fetchWindy (só "agora") e
// fetchWindyHourlySeries (a previsão hora a hora inteira) — a API já devolve a série
// completa num único POST, então extrair só o índice mais próximo (como fetchWindy fazia
// sozinho antes) descartava o resto sem necessidade.
async function fetchWindyRaw(lat: string, lng: string): Promise<WindyRaw | null> {
  const key = process.env.WINDY_API_KEY
  if (!key) return null

  const endpoint = 'https://api.windy.com/api/point-forecast/v2'
  try {
    const [waveRes, windRes] = await Promise.all([
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 'waves' é a altura significativa TOTAL combinada (soma de wind waves + todos os
        // trens de swell, não só o maior componente isolado) — achado 24/ago/2026: o código
        // antes pedia só windWaves+swell1 e usava Math.max(altura de um, altura do outro),
        // que ignora swell2/swell3 e não é a forma correta de combinar alturas de onda
        // independentes (Hs combinado ≈ raiz da soma dos quadrados, não o maior isolado).
        // Isso fazia a altura bruta vir bem menor que o que Windy/Surfline mostram pro
        // mesmo ponto — em Campeche, ~0.9m nosso contra ~1.7-1.8m combinado real. swell1
        // continua sendo pedido só pelo período/direção (mais informativos pro score que
        // os da onda combinada).
        // 'levels' é exigido pela API mesmo pro modelo de onda (achado 24/ago/2026: sem
        // isso a Windy retornava 400 "levels must be an array") — só a chamada de vento
        // abaixo tinha esse campo antes.
        body: JSON.stringify({ lat: parseFloat(lat), lon: parseFloat(lng), model: 'gfsWave', parameters: ['waves', 'swell1'], levels: ['surface'], key }),
      }),
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: parseFloat(lat), lon: parseFloat(lng), model: 'gfs', parameters: ['wind', 'temp'], levels: ['surface'], key }),
      }),
    ])
    if (!waveRes.ok || !windRes.ok) {
      const waveErrBody = !waveRes.ok ? await waveRes.text() : null
      const windErrBody = !windRes.ok ? await windRes.text() : null
      console.error('[liveConditions] Windy HTTP não-ok:', waveRes.status, waveErrBody, '|', windRes.status, windErrBody)
      return null
    }

    const waveData = await waveRes.json() as Record<string, unknown>
    const windData = await windRes.json() as Record<string, unknown>
    if ('error' in waveData || 'error' in windData) {
      console.error('[liveConditions] Windy retornou erro:', waveData.error ?? windData.error)
      return null
    }

    const ts = (waveData.ts ?? windData.ts) as number[] | undefined
    if (!ts?.length) {
      console.error('[liveConditions] Windy sem timestamps (ts) na resposta')
      return null
    }
    const windTs = (windData.ts ?? ts) as number[]

    return { ts, windTs, waveData, windData }
  } catch (err) {
    console.error('[liveConditions] Windy lançou exceção:', err)
    return null
  }
}

function extractWindyPoint(raw: WindyRaw, wi: number, wIdx: number): LiveConditions | null {
  const finalH = ((raw.waveData['waves_height-surface'] as number[])?.[wi] ?? 0)
  const sP = ((raw.waveData['swell1_period-surface'] as number[])?.[wi] ?? 8)
  const sD = ((raw.waveData['swell1_direction-surface'] as number[])?.[wi] ?? 90)
  if (finalH < 0.05) return null

  const wu = ((raw.windData['wind_u-surface'] as number[])?.[wIdx] ?? 0)
  const wv = ((raw.windData['wind_v-surface'] as number[])?.[wIdx] ?? 0)
  const windSpeedKmh = Math.round(Math.sqrt(wu * wu + wv * wv) * 3.6)
  const windDirDeg = (Math.atan2(-wu, -wv) * 180 / Math.PI + 360) % 360

  const tempK = (raw.windData['temp-surface'] as number[])?.[wIdx]
  const waterTemperature = tempK != null ? Math.round(tempK - 273.15) : null

  return {
    waveHeight: Number(finalH.toFixed(1)),
    swellPeriod: Math.round(sP),
    swellDirection: degToDir(sD),
    windSpeed: windSpeedKmh,
    windDir: degToDir(windDirDeg),
    waterTemperature,
  }
}

async function fetchWindy(lat: string, lng: string): Promise<LiveConditions | null> {
  const raw = await fetchWindyRaw(lat, lng)
  if (!raw) return null
  const point = extractWindyPoint(raw, nearestTsIndex(raw.ts), nearestTsIndex(raw.windTs))
  if (!point) {
    console.error('[liveConditions] Windy waves_height muito baixo/ausente')
    return null
  }
  return point
}

export interface WindyHourPoint extends LiveConditions {
  date: string  // "AAAA-MM-DD" no fuso de Floripa
  hour: number  // 0-23 no fuso de Floripa
}

// Série hora a hora completa da Windy (não só "agora") — usada por hourly.ts pra manter a
// Melhor Janela do Dia na MESMA fonte em todas as horas, não só na hora atual. Sem isso,
// "agora" vinha da Windy (fetchWindy acima) enquanto as próximas horas vinham só do
// Open-Meteo (_hourlyForecast.ts) — dois modelos diferentes podem divergir bastante na
// direção do swell num mesmo ponto/instante, e como a altura exposta depende fortemente
// dessa direção (applyDirectionalExposure), a troca de fonte de uma hora pra outra podia
// criar uma queda impossível fisicamente (achado 24/ago/2026, reportado pelo usuário: 1.4m
// "agora" caindo pra 0.4m já na hora seguinte, no Morro das Pedras — Windy tinha o swell
// vindo de E, Open-Meteo tinha o MESMO swell vindo de SSE pro mesmo ponto/instante).
export async function fetchWindyHourlySeries(lat: string, lng: string): Promise<WindyHourPoint[] | null> {
  const raw = await fetchWindyRaw(lat, lng)
  if (!raw) return null

  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  })

  const points: WindyHourPoint[] = []
  raw.ts.forEach((t, i) => {
    const ms = t > 1e11 ? t : t * 1000
    const parts = fmt.formatToParts(new Date(ms))
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
    const date = `${get('year')}-${get('month')}-${get('day')}`
    const hour = parseInt(get('hour'), 10) % 24

    const wIdx = nearestIndexForMs(ms, raw.windTs)
    const point = extractWindyPoint(raw, i, wIdx)
    if (point) points.push({ ...point, date, hour })
  })

  return points.length > 0 ? points : null
}

function formatTimeBrasilia(isoString: string): string {
  const timePart = isoString.split('T')[1]
  return timePart ? timePart.substring(0, 5) : ''
}

async function fetchOpenMeteo(lat: string, lng: string): Promise<LiveConditions | null> {
  try {
    const [marineRes, weatherRes] = await Promise.all([
      fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&current=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction,sea_surface_temperature&length_unit=metric`),
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=wind_speed_10m,wind_direction_10m&daily=sunrise,sunset&wind_speed_unit=kmh&timezone=America%2FSao_Paulo`),
    ])
    if (!marineRes.ok || !weatherRes.ok) return null

    interface OpenMeteoMarine { error?: string; current?: { swell_wave_height?: number; swell_wave_period?: number; swell_wave_direction?: number; wave_height?: number; wave_period?: number; wave_direction?: number; sea_surface_temperature?: number } }
    interface OpenMeteoWeather { error?: string; current?: { wind_speed_10m?: number; wind_direction_10m?: number }; daily?: { sunrise?: string[]; sunset?: string[] } }
    const marine = await marineRes.json() as OpenMeteoMarine
    const weather = await weatherRes.json() as OpenMeteoWeather
    if (marine.error || weather.error) return null

    // wave_height é a altura combinada (wind waves + swell) — swell_wave_height sozinho é só
    // o componente de swell, sempre menor ou igual ao total. A prioridade estava invertida
    // (achado 24/ago/2026, mesmo problema do fetchWindy acima): preferia o componente menor
    // em vez do total real.
    const waveHeight = Number((marine.current?.wave_height ?? marine.current?.swell_wave_height ?? 0).toFixed(1))
    if (waveHeight < 0.1 || Number.isNaN(waveHeight)) return null

    return {
      waveHeight,
      swellPeriod: Math.round(marine.current?.swell_wave_period ?? marine.current?.wave_period ?? 8),
      swellDirection: degToDir(marine.current?.swell_wave_direction ?? marine.current?.wave_direction ?? 180),
      windSpeed: Math.round(weather.current?.wind_speed_10m ?? 0),
      windDir: degToDir(weather.current?.wind_direction_10m ?? 0),
      waterTemperature: marine.current?.sea_surface_temperature != null
        ? Math.round(marine.current.sea_surface_temperature)
        : null,
      sunrise: formatTimeBrasilia(weather.daily?.sunrise?.[0] ?? ''),
      sunset: formatTimeBrasilia(weather.daily?.sunset?.[0] ?? ''),
    }
  } catch {
    return null
  }
}

async function fetchStormglass(lat: string, lng: string): Promise<LiveConditions | null> {
  const key = process.env.STORMGLASS_API_KEY
  if (!key) return null

  try {
    const params = 'waveHeight,wavePeriod,waveDirection,swellHeight,swellPeriod,swellDirection,windSpeed,windDirection,waterTemperature'
    const res = await fetch(
      `https://api.stormglass.io/v2/weather/point?lat=${lat}&lng=${lng}&params=${params}`,
      { headers: { Authorization: key } }
    )
    interface StormglassHour { time: string; [key: string]: Record<string, number> | string }
    const data = await res.json() as { hours?: StormglassHour[] }
    if (!data.hours?.length) return null

    const nowMs = Date.now()
    const hour = data.hours.reduce((best, h) =>
      Math.abs(new Date(h.time).getTime() - nowMs) < Math.abs(new Date(best.time).getTime() - nowMs) ? h : best
    )

    const pick = (k: string): number | null => {
      const obj = hour[k]
      if (!obj || typeof obj === 'string') return null
      const vals = Object.values(obj).filter((v): v is number => typeof v === 'number')
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    }

    const wH = pick('swellHeight') ?? pick('waveHeight')
    if (!wH || Number.isNaN(wH)) return null

    const windSpd = pick('windSpeed') // m/s
    return {
      waveHeight: Number(wH.toFixed(1)),
      swellPeriod: Math.round(pick('swellPeriod') ?? pick('wavePeriod') ?? 8),
      swellDirection: degToDir(pick('swellDirection') ?? pick('waveDirection') ?? 90),
      windSpeed: Math.round((windSpd ?? 0) * 3.6),
      windDir: degToDir(pick('windDirection') ?? 0),
      waterTemperature: pick('waterTemperature') != null ? Math.round(pick('waterTemperature')!) : null,
    }
  } catch {
    return null
  }
}

// Mesma cascata que já era usada só dentro de surf.ts: Windy (melhor qualidade) →
// Open-Meteo (gratuito) → Stormglass (fallback). Loga qual fonte respondeu de fato (mesmo
// padrão de callChatCascade em surf-chat.ts) — sem isso não dava pra saber, só pelos
// números, se a Windy estava mesmo respondendo ou se o app rodava só no fallback
// silenciosamente (achado 24/ago/2026 investigando altura de onda divergente do Surfline).
export async function fetchLiveConditions(lat: string, lng: string): Promise<LiveConditions | null> {
  const windy = await fetchWindy(lat, lng)
  if (windy) { console.log('[liveConditions] Fonte: windy'); return windy }

  const openMeteo = await fetchOpenMeteo(lat, lng)
  if (openMeteo) { console.log('[liveConditions] Fonte: open-meteo (windy falhou)'); return openMeteo }

  const stormglass = await fetchStormglass(lat, lng)
  if (stormglass) { console.log('[liveConditions] Fonte: stormglass (windy e open-meteo falharam)'); return stormglass }

  console.error('[liveConditions] Todas as fontes falharam')
  return null
}
