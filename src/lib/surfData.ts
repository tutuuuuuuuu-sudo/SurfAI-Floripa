import { getWindyForecast } from './weatherApi'
import { getRealWaterTemp } from './weatherData'
import { calculateSurfScore, WIND_DEG as _WIND_DEG } from '../../api/_scoreEngine'
import { getRatingInfo } from './rating'

export interface SubRegion {
  id: string
  name: string
  description?: string
  lat: number
  lng: number
  bestNow?: boolean
  swellDirections?: string[]
  tolerance?: 'estreita' | 'ampla'
  exposicao?: number
}

export interface WaterConditions {
  temperature: number
  wetsuit: {
    thickness: string
  }
}

export interface BeachCondition {
  id: string
  name: string
  region: 'Sul' | 'Leste' | 'Norte' | 'Centro'
  subRegions?: SubRegion[]
  score: number
  waveHeight: number
  windSpeed: number
  windDirection: string
  swellDirection: string
  swellPeriod: number
  tide: 'Enchendo' | 'Secando' | 'Cheia' | 'Vazia'
  tideHeight: number
  level: 'Iniciante' | 'Intermediário' | 'Avançado'
  boardSuggestion: string
  waterConditions: WaterConditions
  bestTimeWindow: string
  sunrise?: string
  sunset?: string
  lat: number
  lng: number
  _beachOrientation?: number
}

// Cache de maré real para Floripa (lat -27.62, lng -48.48)
// Usar objeto em vez de variável solta para facilitar reset em testes
const tideState: { cache: { heights: number[], times: string[], fetched: number } | null } = { cache: null }

async function fetchRealTideData(): Promise<{ heights: number[], times: string[] } | null> {
  const now = Date.now()
  if (tideState.cache && (now - tideState.cache.fetched) < 30 * 60 * 1000) {
    return { heights: tideState.cache.heights, times: tideState.cache.times }
  }
  try {
    const res = await fetch('/api/tide?type=tide', { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const data = await res.json() as { heights?: number[]; times?: string[]; error?: string }
    if (data.error || !data.heights || !data.times) return null
    tideState.cache = { heights: data.heights, times: data.times, fetched: now }
    return { heights: tideState.cache.heights, times: tideState.cache.times }
  } catch { return null }
}

function getTideFromData(heights: number[], times: string[]): { height: number, state: 'Enchendo' | 'Secando' | 'Cheia' | 'Vazia' } {
  // Encontra índice atual
  // Open-Meteo retorna times em horário local (BRT = UTC-3); toISOString() é UTC
  const nowStr = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 13)
  let idx = times.findIndex(t => t.startsWith(nowStr))
  if (idx < 0) idx = 0

  const h = heights[idx] ?? 0.5
  const prev = heights[Math.max(0, idx - 1)] ?? h
  const next = heights[Math.min(heights.length - 1, idx + 1)] ?? h

  const trend = next - prev
  let state: 'Enchendo' | 'Secando' | 'Cheia' | 'Vazia'
  if (trend > 0.05) state = 'Enchendo'
  else if (trend < -0.05) state = 'Secando'
  else if (h > 0.6) state = 'Cheia'
  else state = 'Vazia'

  return { height: Number(h.toFixed(2)), state }
}

// Fallback matemático se API falhar
const getTideHeight = (): number => {
  const now = new Date()
  const currentHour = now.getHours() + now.getMinutes() / 60
  const amplitude = 0.20, midLevel = 0.50, period = 12.4
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
  const phaseOffset = (dayOfYear * 0.8) % period
  return Number((midLevel + amplitude * Math.cos((2 * Math.PI * (currentHour + phaseOffset)) / period)).toFixed(2))
}

// Sem descrição textual — só espessura
const getWetsuitInfo = (temp: number) => {
  if (temp >= 24) return { thickness: '2mm ou lycra' }
  if (temp >= 20) return { thickness: '3/2mm' }
  if (temp >= 18) return { thickness: '4/3mm' }
  return { thickness: '5/4mm + touca' }
}

export function degreesToWindDir(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

export const WIND_DEG = _WIND_DEG

// Fallback de maré por hora do dia (usado se API falhar)
const getTide = (): 'Enchendo' | 'Secando' | 'Cheia' | 'Vazia' => {
  const hour = new Date().getHours()
  if (hour >= 6 && hour <= 9) return 'Enchendo'
  if (hour >= 10 && hour <= 13) return 'Cheia'
  if (hour >= 14 && hour <= 17) return 'Secando'
  if (hour >= 18 && hour <= 21) return 'Enchendo'
  return 'Vazia'
}

// Nível baseado na altura de onda E no score — evita dizer "Iniciante" numa praia com
// score baixo por vento onshore forte, o que pode ser perigoso para iniciantes.
const getLevel = (waveHeight: number, score: number): 'Iniciante' | 'Intermediário' | 'Avançado' => {
  if (waveHeight > 1.0) return 'Avançado'
  if (waveHeight >= 0.5 || score < 5) return 'Intermediário'
  return 'Iniciante'
}

const getBoardSuggestion = (waveHeight: number): string => {
  if (waveHeight > 1.5) return 'Shortboard 5\'10" - 6\'2"'
  if (waveHeight > 1.0) return 'Shortboard 6\'2" - 6\'4"'
  if (waveHeight >= 0.5) return 'Fish 6\'0" ou Funboard 7\'0"'
  return 'Longboard 8\'0"+'
}

// Ordem de bússola usada para medir "distância angular" entre a direção atual do swell
// e a(s) direção(ões) ideal(is) de um sub-pico — fonte única, usada no servidor e na tela.
const SWELL_DIR_ORDER = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']

const swellAngularDiff = (idealDirs: string[], swellDirection: string): number => {
  const currentIdx = SWELL_DIR_ORDER.indexOf(swellDirection)
  let minDiff = 8
  idealDirs.forEach(dir => {
    const idx = SWELL_DIR_ORDER.indexOf(dir)
    if (idx >= 0 && currentIdx >= 0) {
      let diff = Math.abs(currentIdx - idx)
      if (diff > 8) diff = 16 - diff
      if (diff < minDiff) minDiff = diff
    }
  })
  return minDiff
}

export interface SubRegionMatch {
  minDiff: number
  waveMin: string
  waveMax: string
  match: string
  matchCls: string
}

// Estima altura e qualidade de um sub-pico específico a partir da altura geral da praia.
// Picos de `tolerance: 'estreita'` (ex: Principal do Campeche) só funcionam de verdade
// perto da sua direção ideal — fora dela, a altura cai bem mais do que num pico "ampla"
// (Lomba do Sabão, Palanque), que aceita uma faixa maior de direções sem perder tanto.
// `exposicao` é um fator independente da direção: sub-picos abrigados por uma ponta/morro
// (ex: Ponta Esquerda dos Açores, perto do costão que protege o Pântano do Sul) têm um teto
// de tamanho mais baixo que o resto da praia mesmo quando o swell bate na direção ideal.
export function getSubRegionMatch(
  swellDirections: string[] | undefined,
  swellDirection: string,
  waveHeight: number,
  tolerance?: 'estreita' | 'ampla',
  exposicao: number = 1.0
): SubRegionMatch {
  const minDiff = swellAngularDiff(swellDirections ?? [], swellDirection)
  const narrow = tolerance === 'estreita'

  const mult = (narrow
    ? (minDiff === 0 ? 1.0 : minDiff === 1 ? 0.55 : minDiff === 2 ? 0.4 : 0.3)
    : (minDiff === 0 ? 1.05 : minDiff === 1 ? 1.00 : minDiff === 2 ? 0.95 : minDiff <= 4 ? 0.88 : 0.80)) * exposicao

  const waveEst = waveHeight * mult
  const waveMin = (waveEst * 0.95).toFixed(1)
  const waveMax = (waveEst * 1.05).toFixed(1)

  const match = narrow
    ? (minDiff === 0 ? 'Swell perfeito' : minDiff === 1 ? 'Swell bom' : 'Swell ruim')
    : (minDiff === 0 ? 'Swell perfeito' : minDiff <= 2 ? 'Swell bom' : minDiff <= 4 ? 'Swell parcial' : 'Swell ruim')
  const matchCls = narrow
    ? (minDiff === 0 ? 'text-rating-good' : minDiff === 1 ? 'text-rating-excellent' : 'text-rating-poor')
    : (minDiff === 0 ? 'text-rating-good' : minDiff <= 2 ? 'text-rating-excellent' : minDiff <= 4 ? 'text-rating-fair' : 'text-rating-poor')

  return { minDiff, waveMin, waveMax, match, matchCls }
}

const getBestSubRegion = (subRegions: { id: string, swellDirections?: string[] }[], swellDirection: string): string => {
  const best = subRegions
    .map(sub => ({ id: sub.id, minDiff: swellAngularDiff(sub.swellDirections ?? [], swellDirection) }))
    .reduce((a, b) => (b.minDiff < a.minDiff ? b : a))
  return best.id
}

function getWindAnalysis(windDir: string, windSpeed: number, beachOrientation: number): string {
  const windDeg = WIND_DEG[windDir] ?? 0
  const offshoreDir = (beachOrientation + 180) % 360
  let diff = Math.abs(windDeg - offshoreDir)
  if (diff > 180) diff = 360 - diff
  if (diff <= 45) return `Vento ${windDir} ${windSpeed}km/h deixando o mar limpo e organizado. `
  if (diff <= 90) return `Vento ${windDir} ${windSpeed}km/h lateral, pode atrapalhar um pouco. `
  return `Vento ${windDir} ${windSpeed}km/h frontal bagunçando as ondas. `
}

interface BeachDefinition {
  id: string
  name: string
  region: 'Sul' | 'Leste' | 'Norte' | 'Centro'
  lat: number
  lng: number
  orientation: number
  bestTimeWindow: string
  subRegions?: { id: string; name: string; lat: number; lng: number; swellDirections?: string[]; tolerance?: 'estreita' | 'ampla'; exposicao?: number }[]
}

const BEACHES: BeachDefinition[] = [
  // ✅ GPS corrigido conforme verificação no Google Maps (prints do usuário)
  { id: 'campeche', name: 'Campeche', region: 'Sul' as const,
    lat: -27.697703, lng: -48.4898603, // Campeche — Lomba do Sabão (bem na areia)
    orientation: 90,
    subRegions: [
      { id: 'lomba-sabao', name: 'Lomba do Sabão', lat: -27.6974, lng: -48.4899, swellDirections: ['E', 'SE'] },
      { id: 'palanque', name: 'Palanque', lat: -27.6929, lng: -48.4870, swellDirections: ['S', 'SSE', 'SE', 'E'] },
      { id: 'principal', name: 'Principal', lat: -27.6893, lng: -48.4825, swellDirections: ['SE', 'SSE'], tolerance: 'estreita' },
    ], bestTimeWindow: '06h - 09h' },
  { id: 'novo-campeche', name: 'Novo Campeche', region: 'Sul' as const,
    lat: -27.6661001, lng: -48.4755307, // Praia do Novo Campeche — bem na areia
    orientation: 90,
    subRegions: [
      { id: 'riozinho', name: 'Riozinho', lat: -27.686650, lng: -48.481560, swellDirections: ['SE', 'ESE'], tolerance: 'estreita' },
      { id: 'centro', name: 'Centro', lat: -27.6648, lng: -48.4784, swellDirections: ['E', 'SE'] },
      { id: 'pico-da-cruz', name: 'Pico da Cruz', lat: -27.6498, lng: -48.4739, swellDirections: ['SE', 'S', 'SSE'] },
    ], bestTimeWindow: '06h - 09h' },
  { id: 'morro-pedras', name: 'Morro das Pedras', region: 'Sul' as const,
    lat: -27.7170897, lng: -48.503436, // Av. Campeche, s/n — Lagoa Pequena
    orientation: 100,
    subRegions: [
      { id: 'areias', name: 'Areias', lat: -27.7108, lng: -48.5002, swellDirections: ['S', 'SE', 'E'] },
      { id: 'meio', name: 'Meio da Praia', lat: -27.7152, lng: -48.5022, swellDirections: ['S', 'SE', 'E'] },
      { id: 'costao', name: 'Costão', lat: -27.7192, lng: -48.5045, swellDirections: ['SE', 'S', 'SSE'] },
    ], bestTimeWindow: '07h - 10h' },
  { id: 'matadeiro', name: 'Matadeiro', region: 'Sul' as const,
    lat: -27.7548429, lng: -48.4985647, // Matadeiro — estacionamento início trilha
    orientation: 110,
    // ✅ Coordenadas dos 2 sub-picos confirmadas pelo usuário no Google Maps.
    subRegions: [
      { id: 'entrada', name: 'Entrada (Esquerdo)', lat: -27.7515, lng: -48.4970, swellDirections: ['E', 'SE'] },
      { id: 'direito', name: 'Canto Direito', lat: -27.7548, lng: -48.4986, swellDirections: ['E', 'SE'] },
    ], bestTimeWindow: '06h - 09h' },
  { id: 'lagoinha-leste', name: 'Lagoinha do Leste', region: 'Sul' as const,
    lat: -27.7732103, lng: -48.4863806, // Lagoinha do Leste — início da trilha (Praia das Pacas)
    orientation: 180, bestTimeWindow: 'Dia todo (acesso por trilha)' },
  { id: 'acores', name: 'Açores', region: 'Sul' as const,
    lat: -27.7837144, lng: -48.5236746, // Praia dos Açores — bem na areia
    orientation: 120,
    subRegions: [
      { id: 'ponta-esquerda', name: 'Ponta Esquerda', lat: -27.7825, lng: -48.5195, swellDirections: ['SE', 'S', 'SSE'], exposicao: 0.8 },
      { id: 'meio', name: 'Meio', lat: -27.7848, lng: -48.5212, swellDirections: ['SE', 'E', 'ESE'] },
    ], bestTimeWindow: '07h - 11h' },
  { id: 'solidao', name: 'Solidão', region: 'Sul' as const,
    lat: -27.7941233, lng: -48.5334965, // Praia da Solidão — acesso areia
    orientation: 130, bestTimeWindow: '08h - 11h' },
  { id: 'armacao', name: 'Armação', region: 'Sul' as const,
    lat: -27.7504078, lng: -48.5017637, orientation: 115,
    subRegions: [
      { id: 'caldeirao', name: 'Caldeirão', lat: -27.7520, lng: -48.5048, swellDirections: ['E', 'SE'] },
      { id: 'meio', name: 'Meio da Praia', lat: -27.7500, lng: -48.5045, swellDirections: ['NE', 'E'] },
    ], bestTimeWindow: '06h - 09h e 16h - 18h' },
  { id: 'naufragados', name: 'Naufragados', region: 'Sul' as const,
    lat: -27.8335587, lng: -48.5641537, // Naufragados — início da Trilha Caminho dos Naufragados
    orientation: 180, bestTimeWindow: 'Depende da maré (acesso por trilha)' },
  { id: 'joaquina', name: 'Joaquina', region: 'Leste' as const,
    lat: -27.6293577, lng: -48.4490173, // Joaquina — bem na areia
    orientation: 90,
    subRegions: [
      { id: 'pedra-do-sami', name: 'Pedra do Sami', lat: -27.6340, lng: -48.4520, swellDirections: ['SE', 'S', 'SSE'] },
      { id: 'meio', name: 'Meio da Praia', lat: -27.6294, lng: -48.4490, swellDirections: ['E', 'SE'] },
      { id: 'canto-direito', name: 'Canto Direito', lat: -27.6250, lng: -48.4460, swellDirections: ['NE', 'E', 'ENE'] },
    ], bestTimeWindow: 'Agora até 11h' },
  { id: 'mole', name: 'Praia Mole', region: 'Leste' as const,
    lat: -27.6022459, lng: -48.4326839, orientation: 85,
    subRegions: [
      { id: 'canto-sul', name: 'Canto Sul (Gruta)', lat: -27.6035, lng: -48.4340, swellDirections: ['SE', 'E', 'ESE'] },
      { id: 'meio', name: 'Meio da Praia', lat: -27.6022, lng: -48.4327, swellDirections: ['E', 'NE'] },
      { id: 'canto-norte', name: 'Canto Norte', lat: -27.5990, lng: -48.4310, swellDirections: ['E', 'NE', 'ENE'] },
    ], bestTimeWindow: '07h - 10h' },
  { id: 'mocambique', name: 'Moçambique', region: 'Leste' as const,
    lat: -27.4937746, lng: -48.3955175, // Moçambique — bem na areia
    orientation: 80,
    subRegions: [
      { id: 'norte', name: 'Canto das Aranhas', lat: -27.4695, lng: -48.3852, swellDirections: ['NE', 'E', 'ENE'], tolerance: 'estreita', exposicao: 0.9 },
      { id: 'meio', name: 'Meio da Praia', lat: -27.4938, lng: -48.3912, swellDirections: ['SE', 'E'] },
    ], bestTimeWindow: '08h - 11h' },
  { id: 'barra-lagoa', name: 'Barra da Lagoa', region: 'Leste' as const,
    lat: -27.5734502, lng: -48.424939, orientation: 75,
    subRegions: [
      { id: 'canal', name: 'Canal da Barra', lat: -27.5765, lng: -48.4185, swellDirections: ['E', 'SE'], exposicao: 0.65 },
      { id: 'norte-da-barra', name: 'Norte da Barra', lat: -27.5688, lng: -48.4252, swellDirections: ['E', 'SE'] },
    ], bestTimeWindow: 'Melhor na maré enchente' },
  { id: 'santinho', name: 'Santinho', region: 'Norte' as const,
    lat: -27.4618653, lng: -48.3761513, // Praia do Santinho — bem na areia
    orientation: 70,
    subRegions: [
      { id: 'costao', name: 'Costão Norte', lat: -27.4575, lng: -48.3735, swellDirections: ['SE', 'E', 'NE'] },
      { id: 'centro', name: 'Centro', lat: -27.4619, lng: -48.3762, swellDirections: ['SE', 'E'] },
      { id: 'canto-sul', name: 'Canto Sul', lat: -27.4658, lng: -48.3788, swellDirections: ['E', 'SE'] },
    ], bestTimeWindow: '15h - 17h' },
]

interface WindyData {
  waveHeight: number
  windSpeed: number
  windDirection: string
  swellPeriod: number
  swellDirection: string
  sunrise?: string
  sunset?: string
}

// Calcula melhor janela do dia dinamicamente usando dados horários da API
function calculateBestWindow(windyData: WindyData | null, beachOrientation: number): string {
  // windyData pode ter hourlyData se a API retornar dados horários
  // Por enquanto usa lógica baseada no vento atual e hora do nascer/pôr do sol
  if (!windyData) return 'Verificar condições'

  const windDeg = WIND_DEG[windyData.windDirection] ?? 0
  const offshoreDir = (beachOrientation + 180) % 360
  let angleDiff = Math.abs(windDeg - offshoreDir)
  if (angleDiff > 180) angleDiff = 360 - angleDiff

  const isOffshore = angleDiff <= 60
  const isLightWind = windyData.windSpeed <= 15
  const hour = new Date().getHours()

  // Em Floripa o vento tipicamente amaina de manhã cedo (offshore) e aumenta à tarde (onshore)
  // Melhor janela = offshore + vento leve = manhã cedo
  if (isOffshore && isLightWind) {
    if (hour < 12) return `${hour.toString().padStart(2,'0')}h - ${Math.min(hour+3, 12).toString().padStart(2,'0')}h`
    return 'Amanhã cedo (06h - 09h)'
  }
  if (isLightWind) {
    return '06h - 09h (vento tende a ser melhor)'
  }
  if (windyData.windSpeed > 20) {
    return 'Aguardar vento baixar'
  }
  return '06h - 09h'
}

const CACHE_DURATION = 15 * 60 * 1000
// Estado do cache isolado — não é variável solta no módulo para facilitar rastreamento
const conditionsState: {
  data: BeachCondition[] | null
  fetchedAt: number
  // Promise em andamento — qualquer chamada concurrent espera essa promise ao invés de
  // disparar um novo fetch. Elimina a race condition de múltiplos useEffect simultâneos.
  inflight: Promise<BeachCondition[]> | null
} = { data: null, fetchedAt: 0, inflight: null }

async function _doFetchConditions(): Promise<BeachCondition[]> {
  const [tideData, realWaterTemp] = await Promise.all([
    fetchRealTideData(),
    getRealWaterTemp(),
  ])
  const tideInfo = tideData
    ? getTideFromData(tideData.heights, tideData.times)
    : { height: getTideHeight(), state: getTide() }
  const tide = tideInfo.state

  // Limita concorrência a 5 praias por vez para não exceder os limites do Vercel Free
  const BATCH_SIZE = 5
  const allResults: PromiseSettledResult<BeachCondition>[] = []

  for (let i = 0; i < BEACHES.length; i += BATCH_SIZE) {
    const batch = BEACHES.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(
      batch.map(async (beach) => {
        const windyData = await getWindyForecast(beach.lat, beach.lng, beach.orientation)

        const waveHeight = Number((windyData?.waveHeight ?? 1.0).toFixed(1))
        const windSpeed = Math.round(windyData?.windSpeed ?? 12)
        const swellPeriod = Math.round(windyData?.swellPeriod ?? 10)
        const swellDirection = windyData?.swellDirection ?? 'SE'
        const waterTemp = realWaterTemp
        const rawWindDir = (windyData?.windDirection ?? 'N').split('(')[0].split(/\s+/)[0].trim().toUpperCase()
        const windDirection = WIND_DEG[rawWindDir] !== undefined ? rawWindDir : 'N'

        const score = calculateSurfScore(waveHeight, windSpeed, swellPeriod, windDirection, beach.orientation)

        let subRegions: SubRegion[] | undefined = undefined
        if (beach.subRegions && beach.subRegions.length > 0) {
          const beachSubs = beach.subRegions
          const bestSubId = getBestSubRegion(beachSubs, swellDirection)
          subRegions = beachSubs.map(sub => ({
            id: sub.id, name: sub.name, lat: sub.lat, lng: sub.lng,
            swellDirections: sub.swellDirections ?? [],
            tolerance: sub.tolerance,
            exposicao: sub.exposicao,
            description: sub.id === bestSubId
              ? `Melhor com swell de ${swellDirection}`
              : `Funciona melhor com swell de ${sub.swellDirections?.join(', ') ?? 'E'}`,
            bestNow: sub.id === bestSubId
          }))
        }

        return {
          id: beach.id, name: beach.name, region: beach.region, subRegions,
          score, waveHeight, windSpeed, windDirection, swellDirection, swellPeriod, tide,
          tideHeight: tideInfo.height, level: getLevel(waveHeight, score),
          boardSuggestion: getBoardSuggestion(waveHeight),
          waterConditions: { temperature: waterTemp, wetsuit: getWetsuitInfo(waterTemp) },
          bestTimeWindow: calculateBestWindow(windyData, beach.orientation),
          sunrise: windyData?.sunrise, sunset: windyData?.sunset,
          lat: beach.lat, lng: beach.lng,
          _beachOrientation: beach.orientation,
        } satisfies BeachCondition
      })
    )
    allResults.push(...batchResults)
  }

  return allResults
    .filter((r): r is PromiseFulfilledResult<BeachCondition> => r.status === 'fulfilled')
    .map(r => r.value)
}

export async function fetchCurrentConditions(): Promise<BeachCondition[]> {
  const now = Date.now()

  // Cache válido — retorna imediatamente
  if (conditionsState.data && (now - conditionsState.fetchedAt) < CACHE_DURATION) {
    return conditionsState.data
  }

  // Já há um fetch em andamento — espera ele terminar em vez de disparar outro
  if (conditionsState.inflight) return conditionsState.inflight

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('fetchCurrentConditions timeout')), 15000)
  )

  conditionsState.inflight = Promise.race([_doFetchConditions(), timeout]).then(conditions => {
    conditionsState.data = conditions
    conditionsState.fetchedAt = Date.now()
    conditionsState.inflight = null
    return conditions
  }).catch(() => {
    conditionsState.inflight = null
    // Em timeout, retorna dados do cache anterior se disponíveis em vez de lançar erro
    if (conditionsState.data && conditionsState.data.length > 0) return conditionsState.data
    throw new Error('fetchCurrentConditions timeout')
  })

  return conditionsState.inflight
}

export function getCurrentConditions(): BeachCondition[] { return conditionsState.data ?? [] }
export function getTopSpots(limit = 3): BeachCondition[] { return getCurrentConditions().sort((a, b) => b.score - a.score).slice(0, limit) }
export function getSpotsByRegion(region: BeachCondition['region']): BeachCondition[] { return getCurrentConditions().filter(s => s.region === region).sort((a, b) => b.score - a.score) }
export function getSpotById(id: string): BeachCondition | undefined { return getCurrentConditions().find(s => s.id === id) }

export function analyzeConditions(spot: BeachCondition): string {
  const orientation = spot._beachOrientation ?? 90
  const ratingLabelToAnalysis: Record<string, string> = {
    'ÉPICO': 'Condições ÉPICAS! ',
    'EXCELENTE': 'Condições EXCELENTES! ',
    'BOM': 'Boas condições para surfar. ',
    'REGULAR': 'Condições medianas. ',
    'RUIM': 'Condições fracas. ',
  }
  let analysis = ratingLabelToAnalysis[getRatingInfo(spot.score).label]

  analysis += getWindAnalysis(spot.windDirection, spot.windSpeed, orientation)

  if (spot.swellPeriod >= 12) analysis += `Período de ${spot.swellPeriod}s trazendo ondas longas e bem formadas. `
  else if (spot.swellPeriod >= 9) analysis += `Período médio de ${spot.swellPeriod}s, ondas razoáveis. `
  else analysis += `Período curto de ${spot.swellPeriod}s, ondas fracas e desorganizadas. `

  if (spot.tide === 'Cheia') analysis += 'Maré cheia, momento ideal para pegar as melhores ondas.'
  else if (spot.tide === 'Enchendo') analysis += 'Maré enchendo, ainda bom para surfar.'
  else if (spot.tide === 'Secando') analysis += 'Maré secando, condições podem mudar.'
  else analysis += 'Maré vazia, cuidado com as pedras.'

  return analysis
}

// IDs das praias que pertencem à região "Centro" no contexto do filtro de regiões.
// Centralizado aqui para evitar duplicação em Home, Navigation e demais páginas.
export const CENTRO_SPOT_IDS = ['novo-campeche', 'joaquina', 'mole', 'barra-lagoa'] as const

// Picos vitrine: acessíveis em /spot/:id sem login, para reduzir a fricção de entrada
// de quem chega por link direto, busca ou anúncio — vê o produto real antes de criar conta.
export const PUBLIC_SPOT_IDS = ['joaquina', 'mole'] as const

// Picos teaser: resumo real aberto sem login, mas previsão/maré/janela ideal ficam
// borrados atrás de CTA. Meio-termo entre PUBLIC_SPOT_IDS (100% aberto) e o resto
// (100% fechado) — usado para SEO/compartilhamento sem abrir mão do cadastro.
export const TEASER_SPOT_IDS = ['campeche', 'novo-campeche', 'matadeiro', 'santinho'] as const
