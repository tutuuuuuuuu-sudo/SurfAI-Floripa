import { getWindyForecast } from './weatherApi'
import { getRealWaterTemp } from './weatherData'

export interface SubRegion {
  id: string
  name: string
  description?: string
  lat: number
  lng: number
  bestNow?: boolean
  swellDirections?: string[]
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
}

// Cache de maré real para Floripa (lat -27.62, lng -48.48)
let tideCache: { heights: number[], times: string[], fetched: number } | null = null

async function fetchRealTideData(): Promise<{ heights: number[], times: string[] } | null> {
  const now = Date.now()
  if (tideCache && (now - tideCache.fetched) < 30 * 60 * 1000) {
    return { heights: tideCache.heights, times: tideCache.times }
  }
  try {
    const res = await fetch(
      'https://marine-api.open-meteo.com/v1/marine?' +
      'latitude=-27.62&longitude=-48.48' +
      '&hourly=sea_level_height_msl' +
      '&timezone=America%2FSao_Paulo&forecast_days=2'
    )
    const data = await res.json() as any
    if (data.error || !data.hourly?.sea_level_height_msl) return null
    tideCache = { heights: data.hourly.sea_level_height_msl, times: data.hourly.time, fetched: now }
    return { heights: tideCache.heights, times: tideCache.times }
  } catch { return null }
}

function getTideFromData(heights: number[], times: string[]): { height: number, state: 'Enchendo' | 'Secando' | 'Cheia' | 'Vazia' } {
  // Encontra índice atual
  const nowStr = new Date().toISOString().slice(0, 13)
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

const WIND_DEG: Record<string, number> = {
  'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5, 'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
  'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5, 'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5,
}


const calculateScore = (waveHeight: number, windSpeed: number, swellPeriod: number, windDir: string, beachOrientation: number): number => {
  // Escala baseada na realidade de Florianópolis:
  // 0.5m-1m = nota 6-8 base, vento >15km/h penaliza abaixo de 7, período curto = 5 base

  // ONDA: 0.5m já dá nota 6, 1m dá nota 8, 2m+ nota 10
  let waveBase = 0
  if (waveHeight >= 2.5) waveBase = 10
  else if (waveHeight >= 2.0) waveBase = 9.5
  else if (waveHeight >= 1.5) waveBase = 9.0
  else if (waveHeight >= 1.2) waveBase = 8.5
  else if (waveHeight >= 1.0) waveBase = 8.0
  else if (waveHeight >= 0.8) waveBase = 7.5
  else if (waveHeight >= 0.6) waveBase = 7.0
  else if (waveHeight >= 0.5) waveBase = 6.5
  else if (waveHeight >= 0.4) waveBase = 5.5
  else waveBase = 4.0

  // VENTO: penalização sobre o waveBase
  // Offshore (<= 45° da direção offshore) = bônus
  // Onshore (> 90°) = penaliza muito
  const wDir = WIND_DEG[windDir] ?? 0
  const offshoreDir = (beachOrientation + 180) % 360
  let angleDiff = Math.abs(wDir - offshoreDir)
  if (angleDiff > 180) angleDiff = 360 - angleDiff

  let windPenalty = 0
  if (angleDiff <= 45) {
    // Offshore — penaliza pouco mesmo com vento forte
    if (windSpeed <= 10) windPenalty = 0
    else if (windSpeed <= 15) windPenalty = -0.3
    else if (windSpeed <= 20) windPenalty = -0.8
    else windPenalty = -1.5
  } else if (angleDiff <= 90) {
    // Lateral
    if (windSpeed <= 10) windPenalty = -0.5
    else if (windSpeed <= 15) windPenalty = -1.0
    else if (windSpeed <= 20) windPenalty = -1.8
    else windPenalty = -2.5
  } else {
    // Onshore — penaliza bastante
    if (windSpeed <= 10) windPenalty = -1.0
    else if (windSpeed <= 15) windPenalty = -2.0
    else if (windSpeed <= 20) windPenalty = -3.0
    else windPenalty = -4.0
  }

  // PERÍODO: ajuste fino em Floripa, período curto é normal (nota base 5)
  // Período longo é bônus, curto não penaliza muito
  let periodAdjust = 0
  if (swellPeriod >= 16) periodAdjust = +0.5
  else if (swellPeriod >= 14) periodAdjust = +0.3
  else if (swellPeriod >= 12) periodAdjust = +0.2
  else if (swellPeriod >= 10) periodAdjust = 0
  else if (swellPeriod >= 8) periodAdjust = -0.2
  else if (swellPeriod >= 7) periodAdjust = -0.4
  else periodAdjust = -0.6  // 5s = ruim mas não catastrófico

  const finalScore = waveBase + windPenalty + periodAdjust
  return Math.min(10, Math.max(1, Number(finalScore.toFixed(1))))
}

// Fallback de maré por hora do dia (usado se API falhar)
const getTide = (): 'Enchendo' | 'Secando' | 'Cheia' | 'Vazia' => {
  const hour = new Date().getHours()
  if (hour >= 6 && hour <= 9) return 'Enchendo'
  if (hour >= 10 && hour <= 13) return 'Cheia'
  if (hour >= 14 && hour <= 17) return 'Secando'
  if (hour >= 18 && hour <= 21) return 'Enchendo'
  return 'Vazia'
}

const getLevel = (waveHeight: number): 'Iniciante' | 'Intermediário' | 'Avançado' => {
  if (waveHeight > 1.0) return 'Avançado'
  if (waveHeight >= 0.5) return 'Intermediário'
  return 'Iniciante'
}

const getBoardSuggestion = (waveHeight: number): string => {
  if (waveHeight > 1.5) return 'Shortboard 5\'10" - 6\'2"'
  if (waveHeight > 1.0) return 'Shortboard 6\'2" - 6\'4"'
  if (waveHeight >= 0.5) return 'Fish 6\'0" ou Funboard 7\'0"'
  return 'Longboard 8\'0"+'
}

const getBestSubRegion = (subRegions: { id: string, swellDirections?: string[] }[], swellDirection: string): string => {
  const best = subRegions.map(sub => ({
    id: sub.id,
    score: sub.swellDirections?.includes(swellDirection) ? 3 : 0
  })).reduce((a, b) => a.score >= b.score ? a : b)
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

// ✅ Canajurê REMOVIDO
const BEACHES = [
  // ✅ GPS corrigido conforme verificação no Google Maps (prints do usuário)
  { id: 'campeche', name: 'Campeche', region: 'Sul' as const,
    lat: -27.697703, lng: -48.4898603, // Campeche — Lomba do Sabão (bem na areia)
    orientation: 90,
    subRegions: [
      { id: 'lomba-sabao', name: 'Lomba do Sabão', lat: -27.6974, lng: -48.4899, swellDirections: ['E', 'SE'] },
      { id: 'palanque', name: 'Palanque', lat: -27.6929, lng: -48.4870, swellDirections: ['SE', 'S', 'SSE'] },
      { id: 'principal', name: 'Principal', lat: -27.6893, lng: -48.4825, swellDirections: ['E', 'NE', 'ENE'] },
    ], bestTimeWindow: '06h - 09h' },
  { id: 'novo-campeche', name: 'Novo Campeche', region: 'Sul' as const,
    lat: -27.6661001, lng: -48.4755307, // Praia do Novo Campeche — bem na areia
    orientation: 90,
    subRegions: [
      { id: 'riozinho', name: 'Riozinho', lat: -27.6545, lng: -48.4710, swellDirections: ['NE', 'E', 'ENE'] },
      { id: 'centro', name: 'Centro', lat: -27.6648, lng: -48.4784, swellDirections: ['E', 'SE'] },
      { id: 'pico-da-cruz', name: 'Pico da Cruz', lat: -27.6498, lng: -48.4739, swellDirections: ['SE', 'S', 'SSE'] },
    ], bestTimeWindow: '06h - 09h' },
  { id: 'morro-pedras', name: 'Morro das Pedras', region: 'Sul' as const,
    lat: -27.7170897, lng: -48.503436, // Av. Campeche, s/n — Lagoa Pequena
    orientation: 100,
    subRegions: [
      { id: 'canto-norte', name: 'Canto Norte', lat: -27.7108, lng: -48.5002, swellDirections: ['E', 'SE', 'ESE'] },
      { id: 'meio', name: 'Meio da Praia', lat: -27.7152, lng: -48.5022, swellDirections: ['SE', 'E'] },
      { id: 'costao', name: 'Costão', lat: -27.7192, lng: -48.5045, swellDirections: ['SE', 'S', 'SSE'] },
    ], bestTimeWindow: '07h - 10h' },
  { id: 'matadeiro', name: 'Matadeiro', region: 'Sul' as const,
    lat: -27.7548429, lng: -48.4985647, // Matadeiro — estacionamento início trilha
    orientation: 110, bestTimeWindow: '06h - 09h' },
  { id: 'lagoinha-leste', name: 'Lagoinha do Leste', region: 'Sul' as const,
    lat: -27.7732103, lng: -48.4863806, // Lagoinha do Leste — início da trilha (Praia das Pacas)
    orientation: 180, bestTimeWindow: 'Dia todo (acesso por trilha)' },
  { id: 'acores', name: 'Açores', region: 'Sul' as const,
    lat: -27.7837144, lng: -48.5236746, // Praia dos Açores — bem na areia
    orientation: 120,
    subRegions: [
      { id: 'ponta-esquerda', name: 'Ponta Esquerda', lat: -27.7825, lng: -48.5195, swellDirections: ['SE', 'S', 'SSE'] },
      { id: 'meio', name: 'Meio', lat: -27.7848, lng: -48.5212, swellDirections: ['SE', 'E', 'ESE'] },
    ], bestTimeWindow: '07h - 11h' },
  { id: 'solidao', name: 'Solidão', region: 'Sul' as const,
    lat: -27.7941233, lng: -48.5334965, // Praia da Solidão — acesso areia
    orientation: 130, bestTimeWindow: '08h - 11h' },
  { id: 'armacao', name: 'Armação', region: 'Sul' as const,
    lat: -27.7504078, lng: -48.5017637, orientation: 115,
    subRegions: [
      { id: 'caldeirao', name: 'Caldeirão', lat: -27.7535, lng: -48.5062, swellDirections: ['SE', 'S', 'SSE'] },
      { id: 'centro', name: 'Centro', lat: -27.7500, lng: -48.5045, swellDirections: ['SE', 'E'] },
      { id: 'matadouro', name: 'Matadouro', lat: -27.7535, lng: -48.5062, swellDirections: ['S', 'SW', 'SSW'] },
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
      { id: 'canto-norte', name: 'Canto Norte', lat: -27.5990, lng: -48.4310, swellDirections: ['NE', 'ENE'] },
    ], bestTimeWindow: '07h - 10h' },
  { id: 'mocambique', name: 'Moçambique', region: 'Leste' as const,
    lat: -27.4937746, lng: -48.3955175, // Moçambique — bem na areia
    orientation: 80,
    subRegions: [
      { id: 'norte', name: 'Norte', lat: -27.4695, lng: -48.3852, swellDirections: ['NE', 'E', 'ENE'] },
      { id: 'meio', name: 'Meio da Praia', lat: -27.4938, lng: -48.3912, swellDirections: ['E', 'NE'] },
    ], bestTimeWindow: '08h - 11h' },
  { id: 'barra-lagoa', name: 'Barra da Lagoa', region: 'Leste' as const,
    lat: -27.5734502, lng: -48.424939, orientation: 75,
    subRegions: [
      { id: 'canal', name: 'Canal da Barra', lat: -27.5765, lng: -48.4185, swellDirections: ['NE', 'E', 'ENE'] },
      { id: 'norte-da-barra', name: 'Norte da Barra', lat: -27.5688, lng: -48.4252, swellDirections: ['NE', 'ENE'] },
    ], bestTimeWindow: 'Melhor na maré enchente' },
  { id: 'santinho', name: 'Santinho', region: 'Norte' as const,
    lat: -27.4618653, lng: -48.3761513, // Praia do Santinho — bem na areia
    orientation: 70,
    subRegions: [
      { id: 'costao', name: 'Costão Norte', lat: -27.4575, lng: -48.3735, swellDirections: ['NE', 'E', 'ENE'] },
      { id: 'centro', name: 'Centro', lat: -27.4619, lng: -48.3762, swellDirections: ['E', 'NE'] },
      { id: 'canto-sul', name: 'Canto Sul', lat: -27.4658, lng: -48.3788, swellDirections: ['E', 'SE'] },
    ], bestTimeWindow: '15h - 17h' },
  { id: 'ponta-aranhas', name: 'Ponta das Aranhas', region: 'Norte' as const,
    lat: -27.4802204, lng: -48.3769892, orientation: 65, bestTimeWindow: '09h - 12h' },
]

// Calcula melhor janela do dia dinamicamente usando dados horários da API
function calculateBestWindow(windyData: any, beachOrientation: number): string {
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

let cachedConditions: BeachCondition[] | null = null
let lastFetchTime = 0
const CACHE_DURATION = 15 * 60 * 1000

export async function fetchCurrentConditions(): Promise<BeachCondition[]> {
  const now = Date.now()
  if (cachedConditions && (now - lastFetchTime) < CACHE_DURATION) return cachedConditions

  // ✅ Busca maré real + temperatura da água UMA vez para toda a ilha
  const [tideData, realWaterTemp] = await Promise.all([
    fetchRealTideData(),
    getRealWaterTemp(),
  ])
  const tideInfo = tideData
    ? getTideFromData(tideData.heights, tideData.times)
    : { height: getTideHeight(), state: getTide() }
  const tide = tideInfo.state

  const results = await Promise.allSettled(
    BEACHES.map(async (beach) => {
      const windyData = await getWindyForecast(beach.lat, beach.lng, beach.orientation)

      const waveHeight = Number((windyData?.waveHeight ?? 1.0).toFixed(1))
      const windSpeed = Math.round(windyData?.windSpeed ?? 12)
      const swellPeriod = Math.round(windyData?.swellPeriod ?? 10)
      const swellDirection = windyData?.swellDirection ?? 'SE'
      const waterTemp = realWaterTemp
      const windDirection = (windyData?.windDirection ?? 'N').split(' ')[0].split('(')[0].trim()

      const score = calculateScore(waveHeight, windSpeed, swellPeriod, windDirection, beach.orientation)

      let subRegions = undefined
      if ((beach as any).subRegions?.length > 0) {
        const beachSubs = (beach as any).subRegions
        const bestSubId = getBestSubRegion(beachSubs, swellDirection)
        subRegions = beachSubs.map((sub: any) => ({
          id: sub.id, name: sub.name, lat: sub.lat, lng: sub.lng,
          swellDirections: sub.swellDirections ?? [],
          description: sub.id === bestSubId
            ? `Melhor com swell de ${swellDirection}`
            : `Funciona melhor com swell de ${sub.swellDirections?.join(', ') ?? 'E'}`,
          bestNow: sub.id === bestSubId
        }))
      }

      return {
        id: beach.id, name: beach.name, region: beach.region, subRegions,
        score, waveHeight, windSpeed, windDirection, swellDirection, swellPeriod, tide,
        tideHeight: tideInfo.height, level: getLevel(waveHeight),
        boardSuggestion: getBoardSuggestion(waveHeight),
        waterConditions: { temperature: waterTemp, wetsuit: getWetsuitInfo(waterTemp) },
        bestTimeWindow: calculateBestWindow(windyData, beach.orientation),
        sunrise: windyData?.sunrise, sunset: windyData?.sunset,
        lat: beach.lat, lng: beach.lng,
        _beachOrientation: beach.orientation,
      } as BeachCondition & { _beachOrientation: number }
    })
  )

  const conditions = results
    .filter((r): r is PromiseFulfilledResult<BeachCondition & { _beachOrientation: number }> => r.status === 'fulfilled')
    .map(r => r.value)

  cachedConditions = conditions
  lastFetchTime = now
  return conditions
}

export function getCurrentConditions(): BeachCondition[] { return cachedConditions ?? [] }
export function getTopSpots(limit = 3): BeachCondition[] { return getCurrentConditions().sort((a, b) => b.score - a.score).slice(0, limit) }
export function getSpotsByRegion(region: BeachCondition['region']): BeachCondition[] { return getCurrentConditions().filter(s => s.region === region).sort((a, b) => b.score - a.score) }
export function getSpotById(id: string): BeachCondition | undefined { return getCurrentConditions().find(s => s.id === id) }

export function analyzeConditions(spot: BeachCondition): string {
  const orientation = (spot as any)._beachOrientation ?? 90
  let analysis = ''
  if (spot.score >= 8) analysis = '🔥 Condições EXCELENTES! '
  else if (spot.score >= 6.5) analysis = '✅ Boas condições para surfar. '
  else if (spot.score >= 5) analysis = '⚠️ Condições medianas. '
  else analysis = '❌ Condições fracas. '

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
