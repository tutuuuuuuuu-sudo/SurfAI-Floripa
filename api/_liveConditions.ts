// Cascata de fontes de condição de surf em tempo real — fonte única usada por surf.ts (nota
// principal exibida na Home/SpotDetails).
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

// Média circular de graus (0-360) — média aritmética simples quebra perto do "corte" 350°/10°
// (daria 180°, errado). Usada pra suavizar direção de swell/vento sobre uma janela.
function circularMeanDeg(degs: number[]): number {
  let sumSin = 0, sumCos = 0
  degs.forEach(d => {
    const rad = (d * Math.PI) / 180
    sumSin += Math.sin(rad)
    sumCos += Math.cos(rad)
  })
  return (Math.atan2(sumSin, sumCos) * 180 / Math.PI + 360) % 360
}

function mean(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

// Janela de índices vizinhos (raio 1 = até 3 instantes) pra suavização, sem sair dos limites.
function windowIndices(idx: number, len: number, radius: number): number[] {
  const start = Math.max(0, idx - radius)
  const end = Math.min(len - 1, idx + radius)
  const out: number[] = []
  for (let i = start; i <= end; i++) out.push(i)
  return out
}

// Correção de viés do modelo bruto — histórico:
//
// 27/ago/2026: descoberto que tanto a Windy (modelo gfsWave) quanto o Open-Meteo (modelo
// padrão) usam o GFS como base, que mostra altura de onda menor que o ECMWF (modelo que
// Windy.com, Surfline, Surfguru e Waves usam pra exibir ao usuário) pro litoral de Floripa.
// Uma comparação pontual (uma praia, um instante) sugeriu ~46% de subestimativa, e um fator
// fixo de ×1.85 foi aplicado sobre TODAS as fontes da cascata, antes de applyDirectionalExposure.
//
// 28/ago/2026: medindo as 14 praias de uma vez (não mais uma amostra única), esse fator fixo
// se provou errado de dois jeitos ao mesmo tempo — achado com o app já em produção com o
// ×1.85 ativo, comparado praia a praia contra Windy/Surfline/Surfguru/Waves:
//   1. O viés real do modelo bruto não é ~46%, varia de -37% a +24% dependendo da praia e do
//      swell do momento (média medida: ~17%) — não existe fator fixo que sirva pras duas pontas.
//   2. Pior ainda: onde o swell bate bem alinhado com a orientação da praia,
//      applyDirectionalExposure quase não desconta nada (fator perto de 1.0), e a correção
//      passa inteira — resultado: praias com swell bem-alinhado estouravam pra 200%+ do que
//      os concorrentes mostravam, enquanto praias com swell de lado (fator baixo, desconto já
//      grande) ficavam por acaso perto do certo. As duas correções (viés de modelo + geometria
//      de praia) empilhadas descontroladamente.
//
// A correção de raiz não é ajustar esse número de novo — é pedir o modelo certo direto na
// fonte. Open-Meteo aceita `models=ecmwf_wam` (o MESMO modelo que Windy.com/Surfline/Surfguru
// mostram), então fetchOpenMeteo() abaixo passou a pedir isso e NÃO aplica mais essa correção
// — não precisa, já está no modelo certo. A Windy (fetchWindy) não vende ECMWF em nenhum
// plano, e o Stormglass também segue de classe GFS — essas duas continuam GFS-based e viraram
// fallback raro (só quando o Open-Meteo falha), então mantêm a correção abaixo. **1.85 segue
// sendo uma estimativa de partida pra essas duas fontes, não uma constante definitiva.**
const MODEL_BIAS_CORRECTION = 1.85

function applyModelBiasCorrection(waveHeight: number): number {
  return Number((waveHeight * MODEL_BIAS_CORRECTION).toFixed(1))
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

// Cache curto (Supabase, compartilhado entre TODAS as instâncias serverless — cache em
// memória local não serve, cada invocação edge pode cair numa instância diferente) pra
// chamada crua à Windy. Achado 24/ago/2026, reportado pelo usuário: a MESMA consulta
// (mesma praia, poucos segundos de diferença) voltava com altura/direção diferentes da
// Windy — 1.2m, depois 1.4m, depois 1.6m em ~20s. Não é ruído de horário do modelo (isso já
// foi suavizado em extractWindyPoint), é a própria API da Windy respondendo de forma
// inconsistente pra requisições quase simultâneas (provável balanceamento entre servidores
// deles com cache/estado diferente). Guardar a resposta por alguns minutos garante que
// todo mundo (app inteiro, todas as instâncias) vê o MESMO número nessa janela, em vez de
// arriscar uma nova chamada à Windy a cada request.
//
// 150min / 2h30 (revisado 28/ago/2026 — ver refresh-windy-cache.ts): o TTL de 15min
// original tornava o consumo de chamadas diretamente proporcional ao tráfego (cada
// praia sem visita há >15min gera uma chamada nova pro primeiro pedido que chegar) —
// achado 27/ago/2026: isso já estava estourando a cota diária de 500 chamadas da Windy
// bem cedo (chegou a esgotar às 09:52 UTC), derrubando o app pro fallback Open-Meteo
// (mais fraco pra essa costa) pelo resto do dia inteiro, cada vez mais cedo conforme o
// tráfego cresce. Agora um cron (`refresh-windy-cache.ts`, a cada 2h, 12x/dia) é o único
// responsável por manter o cache quente — 14 praias × 2 chamadas × 12 = 336
// chamadas/dia, bem abaixo do limite, IMPORTANTE que TTL fique bem maior que o
// intervalo do cron (2h) pra pedido de usuário nunca disparar chamada reativa própria
// nesse meio-tempo (senão volta a depender de tráfego). Esse valor de 15min continua
// sendo usado só como referência de "idade máxima aceitável" pro cache do navegador
// (src/lib/surfData.ts) — as duas camadas não precisam mais bater exatamente, já que a
// camada de servidor agora é atualizada por tempo fixo, não por pedido.
const WINDY_CACHE_TTL_MS = 150 * 60 * 1000

async function getCachedWindyRaw(cacheKey: string): Promise<WindyRaw | null> {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('[liveConditions] cache: SUPABASE_URL/SERVICE_ROLE_KEY ausente')
    return null
  }
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/live_conditions_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&select=payload,fetched_at`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    )
    if (!res.ok) {
      console.error('[liveConditions] cache GET não-ok:', res.status, await res.text())
      return null
    }
    const rows = await res.json() as { payload: WindyRaw; fetched_at: string }[]
    const row = rows[0]
    if (!row) return null
    const ageMs = Date.now() - new Date(row.fetched_at).getTime()
    if (ageMs > WINDY_CACHE_TTL_MS) return null
    console.log('[liveConditions] cache HIT', cacheKey, `idade=${Math.round(ageMs / 1000)}s`)
    return row.payload
  } catch (err) {
    console.error('[liveConditions] cache GET lançou exceção:', err)
    return null
  }
}

async function setCachedWindyRaw(cacheKey: string, raw: WindyRaw): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/live_conditions_cache`, {
      method: 'POST',
      headers: {
        apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ cache_key: cacheKey, payload: raw, fetched_at: new Date().toISOString() }),
    })
    if (!res.ok) {
      console.error('[liveConditions] cache SET não-ok:', res.status, await res.text())
    } else {
      console.log('[liveConditions] cache SET ok', cacheKey)
    }
  } catch (err) {
    console.error('[liveConditions] cache SET lançou exceção:', err)
  }
}

// Chamada crua à Windy, usada por fetchWindy (fallback de "agora", ver fetchLiveConditions).
//
// Faz a chamada ao vivo à Windy e grava no cache, sem checar se já existe uma entrada
// válida antes — usado tanto pelo caminho reativo (fetchWindyRaw, quando o cache expirou)
// quanto pelo cron proativo (refresh-windy-cache.ts, que sempre quer forçar um dado novo,
// nunca ler o que já está lá). Extraído em 28/ago/2026 justamente pra esse cron poder
// reaproveitar a mesma lógica de chamada+gravação sem duplicar.
export async function fetchAndCacheWindyRaw(lat: string, lng: string): Promise<WindyRaw | null> {
  const cacheKey = `windy:${lat}:${lng}`
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

    const raw: WindyRaw = { ts, windTs, waveData, windData }
    await setCachedWindyRaw(cacheKey, raw)
    return raw
  } catch (err) {
    console.error('[liveConditions] Windy lançou exceção:', err)
    return null
  }
}

// Caminho reativo — usado por fetchWindy (pedido real de usuário):
// lê o cache primeiro, só cai pra chamada ao vivo se não tiver nada válido. Com o cron
// proativo (refresh-windy-cache.ts) rodando a cada 2h e o TTL bem mais largo que isso, o
// caminho "sem cache" aqui deve ser raro em operação normal — fica como rede de segurança
// pra quando o cron falhar/atrasar, não como caminho principal de consumo de cota.
async function fetchWindyRaw(lat: string, lng: string): Promise<WindyRaw | null> {
  const cacheKey = `windy:${lat}:${lng}`
  const cached = await getCachedWindyRaw(cacheKey)
  if (cached) return cached
  return fetchAndCacheWindyRaw(lat, lng)
}

// Suaviza sobre uma pequena janela de instantes vizinhos ao redor de `wi`/`wIdx` (raio 1 —
// até 3 pontos), em vez de usar só o instante mais próximo. Achado 24/ago/2026, reportado
// pelo usuário: a mesma praia (Campeche) mostrou 1.5m numa consulta e 0.7m minutos depois,
// sem nenhuma mudança de código — a Windy retorna leituras de altura/direção de swell que
// oscilam bastante em poucos minutos pro litoral de Floripa, e pegar um único instante
// amplifica esse ruído em vez de suavizar. Direção usa média circular (evita o bug de
// "350° e 10° têm média 180°").
function extractWindyPoint(raw: WindyRaw, wi: number, wIdx: number): LiveConditions | null {
  const heights = raw.waveData['waves_height-surface'] as number[] | undefined
  const periods = raw.waveData['swell1_period-surface'] as number[] | undefined
  const dirs = raw.waveData['swell1_direction-surface'] as number[] | undefined
  if (!heights?.length) return null

  const hIdxs = windowIndices(wi, heights.length, 1)
  const finalH = mean(hIdxs.map(i => heights[i] ?? heights[wi] ?? 0))
  if (finalH < 0.05) return null
  const sP = mean(hIdxs.map(i => periods?.[i] ?? periods?.[wi] ?? 8))
  const sD = circularMeanDeg(hIdxs.map(i => dirs?.[i] ?? dirs?.[wi] ?? 90))

  const wus = raw.windData['wind_u-surface'] as number[] | undefined
  const wvs = raw.windData['wind_v-surface'] as number[] | undefined
  const wIdxs = windowIndices(wIdx, Math.max(wus?.length ?? 1, 1), 1)
  const wu = mean(wIdxs.map(i => wus?.[i] ?? 0))
  const wv = mean(wIdxs.map(i => wvs?.[i] ?? 0))
  const windSpeedKmh = Math.round(Math.sqrt(wu * wu + wv * wv) * 3.6)
  const windDirDeg = (Math.atan2(-wu, -wv) * 180 / Math.PI + 360) % 360

  const temps = raw.windData['temp-surface'] as number[] | undefined
  const tempSamples = wIdxs.map(i => temps?.[i]).filter((v): v is number => v != null)
  const waterTemperature = tempSamples.length ? Math.round(mean(tempSamples) - 273.15) : null

  return {
    waveHeight: applyModelBiasCorrection(finalH),
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

function formatTimeBrasilia(isoString: string): string {
  const timePart = isoString.split('T')[1]
  return timePart ? timePart.substring(0, 5) : ''
}

async function fetchOpenMeteo(lat: string, lng: string): Promise<LiveConditions | null> {
  try {
    // models=ecmwf_wam (achado 28/ago/2026): pede o modelo ECMWF direto, o mesmo que
    // Windy.com/Surfline/Surfguru/Waves mostram — em vez do modelo padrão da Open-Meteo
    // (classe GFS, sistematicamente mais baixo pro litoral de Floripa, ver comentário de
    // MODEL_BIAS_CORRECTION acima). Por isso NÃO aplica mais applyModelBiasCorrection aqui:
    // pedir o modelo certo resolve o viés na raiz, sem precisar de multiplicador nenhum.
    const [marineRes, weatherRes] = await Promise.all([
      fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&current=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction,sea_surface_temperature&length_unit=metric&models=ecmwf_wam`),
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
    const waveHeightBruto = marine.current?.wave_height ?? marine.current?.swell_wave_height ?? 0
    if (waveHeightBruto < 0.1 || Number.isNaN(waveHeightBruto)) return null

    return {
      waveHeight: Number(waveHeightBruto.toFixed(1)),
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
      waveHeight: applyModelBiasCorrection(wH),
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

// Cascata: Open-Meteo (ecmwf_wam) → Windy (fallback) → Stormglass (fallback). Invertida em
// 28/ago/2026 — Open-Meteo virou principal por pedir o modelo ECMWF direto (o mesmo que os
// concorrentes mostram, ver comentário de MODEL_BIAS_CORRECTION acima), enquanto a Windy não
// vende ECMWF em nenhum plano. Windy/Stormglass ficam como rede de segurança pra quando o
// Open-Meteo falhar — o cron de refresh-windy-cache.ts continua rodando pra manter esse
// fallback pronto, mesmo recebendo bem menos tráfego agora que não é mais o caminho principal.
//
// Nota de risco (decisão do usuário, 28/ago/2026): o tier gratuito da Open-Meteo proíbe uso
// comercial ("apps com assinatura ou anúncio" é citado explicitamente nos termos deles) — o
// app já usava a Open-Meteo como fallback antes disso, e a Windy free tier também é rotulada
// "Testing, não para produção" pela própria Windy, então nenhuma das duas fontes gratuitas
// era 100% aderente aos termos mesmo antes dessa mudança. Virar fonte principal aumenta o
// volume nessa situação, não cria uma categoria de risco nova. Decisão consciente: sem
// orçamento agora pro tier pago (Open-Meteo Standard, ~R$150/mês), aceitar o risco
// operacional (chave podendo ser bloqueada sem aviso) em troca de dados corretos hoje.
//
// Loga qual fonte respondeu de fato (mesmo padrão de callChatCascade em surf-chat.ts) — sem
// isso não dava pra saber, só pelos números, se a fonte principal estava mesmo respondendo ou
// se o app rodava só no fallback silenciosamente (achado 24/ago/2026 investigando altura de
// onda divergente do Surfline).
export async function fetchLiveConditions(lat: string, lng: string): Promise<LiveConditions | null> {
  const openMeteo = await fetchOpenMeteo(lat, lng)
  if (openMeteo) { console.log('[liveConditions] Fonte: open-meteo (ecmwf_wam)'); return openMeteo }

  const windy = await fetchWindy(lat, lng)
  if (windy) { console.log('[liveConditions] Fonte: windy (open-meteo falhou)'); return windy }

  const stormglass = await fetchStormglass(lat, lng)
  if (stormglass) { console.log('[liveConditions] Fonte: stormglass (open-meteo e windy falharam)'); return stormglass }

  console.error('[liveConditions] Todas as fontes falharam')
  return null
}
