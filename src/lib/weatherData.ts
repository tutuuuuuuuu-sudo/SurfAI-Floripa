// Reexporta de weatherApi para manter compatibilidade com imports existentes
export { getRealTide, getRealWaterTemp } from './weatherApi'
import { calculateSurfScore } from '../../api/_scoreEngine'
import { getRatingInfo } from './rating'

export interface WeatherForecast {
  date: string
  dayName: string
  waveHeight: number
  windSpeed: number
  windDirection: string
  swellPeriod: number
  temperature: number
  condition: 'Excelente' | 'Bom' | 'Regular' | 'Ruim'
  score: number
  locked?: boolean     // true = dia bloqueado para free
  isFallback?: boolean // true = API falhou, dados estimados
}


function getConditionFromScore(score: number): 'Excelente' | 'Bom' | 'Regular' | 'Ruim' {
  const label = getRatingInfo(score).label
  if (label === 'ÉPICO' || label === 'EXCELENTE') return 'Excelente'
  if (label === 'BOM') return 'Bom'
  if (label === 'REGULAR') return 'Regular'
  return 'Ruim'
}

// Coordenadas aproximadas (centro geográfico) para busca de previsão meteorológica.
// Diferem intencionalmente das coords em surfData.ts, que apontam para a areia exata.
const BEACH_COORDS: Record<string, { lat: number, lng: number }> = {
  'campeche': { lat: -27.6683, lng: -48.4772 },
  'novo-campeche': { lat: -27.6450, lng: -48.4650 },
  'morro-pedras': { lat: -27.6761, lng: -48.4842 },
  'matadeiro': { lat: -27.7342, lng: -48.5167 },
  'lagoinha-leste': { lat: -27.7892, lng: -48.5289 },
  'acores': { lat: -27.7572, lng: -48.5125 },
  'solidao': { lat: -27.7456, lng: -48.5089 },
  'armacao': { lat: -27.7447, lng: -48.5044 },
  'naufragados': { lat: -27.8456, lng: -48.5623 },
  'joaquina': { lat: -27.6214, lng: -48.4433 },
  'mole': { lat: -27.5989, lng: -48.4381 },
  'mocambique': { lat: -27.5647, lng: -48.4208 },
  'barra-lagoa': { lat: -27.5767, lng: -48.4194 },
  'santinho': { lat: -27.4433, lng: -48.3917 },
  'ponta-aranhas': { lat: -27.4256, lng: -48.3889 },
}

const forecastCache: Record<string, { data: WeatherForecast[], time: number }> = {}
const CACHE_DURATION = 15 * 60 * 1000

// Dias gratuitos — controle de UX local (bloquear além desse limite no servidor via /api/forecast)
export const FREE_DAYS = 3

export interface CurrentConditionsForForecast {
  waveHeight: number
  windSpeed: number
  swellPeriod: number
  windDirection: string
  waterTemperature?: number
  score: number
}

export async function getWeatherForecast(
  spotId: string,
  currentConditions?: CurrentConditionsForForecast,
  isPremium = false,
  orientation = 90
): Promise<WeatherForecast[]> {
  const now = Date.now()

  // Cache hit: retorna dados em memória sem bater na rede
  if (forecastCache[spotId] && (now - forecastCache[spotId].time) < CACHE_DURATION) {
    const cached = [...forecastCache[spotId].data]
    // Substitui o dia 0 pelos dados reais já carregados na tela
    if (currentConditions && cached.length > 0) {
      cached[0] = {
        ...cached[0],
        waveHeight: currentConditions.waveHeight,
        windSpeed: currentConditions.windSpeed,
        swellPeriod: currentConditions.swellPeriod,
        windDirection: currentConditions.windDirection.split(' ')[0].trim(),
        temperature: currentConditions.waterTemperature ?? cached[0].temperature,
        score: currentConditions.score,
        condition: getConditionFromScore(currentConditions.score),
        locked: false,
      }
    }
    return applyPremiumLock(cached, isPremium)
  }

  const coords = BEACH_COORDS[spotId]
  if (!coords) return applyPremiumLock(getFallbackForecast(), isPremium)

  try {
    // Chama o endpoint do servidor que controla quantos dias retornar baseado no plano do usuário.
    // O token é enviado para que o servidor valide o premium — dados além de 3 dias nunca chegam ao browser.
    const { data: { session } } = await (await import('./supabase')).supabase.auth.getSession()
    const token = session?.access_token

    const params = new URLSearchParams({
      lat: coords.lat.toString(),
      lng: coords.lng.toString(),
      spotId,
      orientation: orientation.toString(),
    })

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(`/api/forecast?${params}`, { headers })
    if (!res.ok) return applyPremiumLock(getFallbackForecast(), isPremium)

    const apiData = await res.json() as {
      forecasts: WeatherForecast[]
      isPremium: boolean
      forecastDays: number
    }

    if (!apiData.forecasts?.length) return applyPremiumLock(getFallbackForecast(), isPremium)

    let forecasts = apiData.forecasts

    // Sobrescreve o dia 0 com as condições atuais (mais precisas) se disponíveis
    if (currentConditions && forecasts.length > 0) {
      forecasts[0] = {
        ...forecasts[0],
        waveHeight: currentConditions.waveHeight,
        windSpeed: currentConditions.windSpeed,
        swellPeriod: currentConditions.swellPeriod,
        windDirection: currentConditions.windDirection.split(' ')[0].trim(),
        temperature: currentConditions.waterTemperature ?? forecasts[0].temperature,
        score: currentConditions.score,
        condition: getConditionFromScore(currentConditions.score),
        locked: false,
      }
    }

    forecastCache[spotId] = { data: forecasts, time: now }
    // O servidor já filtrou os dias — applyPremiumLock garante UX consistente no cliente
    return applyPremiumLock(forecasts, isPremium)
  } catch {
    return applyPremiumLock(getFallbackForecast(), isPremium)
  }
}

// Aplica o lock de UX nos dias além do limite free.
// O servidor já bloqueou o dado real — esse lock é apenas visual (cadeado na UI).
function applyPremiumLock(forecasts: WeatherForecast[], isPremium: boolean): WeatherForecast[] {
  if (isPremium) return forecasts.map(f => ({ ...f, locked: false }))
  return forecasts.map((f, i) => ({ ...f, locked: i >= FREE_DAYS }))
}

function getFallbackForecast(): WeatherForecast[] {
  const today = new Date()
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    const score = calculateSurfScore(1.0, 12, 10, 'N', 90)
    return {
      date: date.toISOString().split('T')[0],
      dayName: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : dayNames[date.getDay()],
      waveHeight: 1.0, windSpeed: 12, windDirection: 'N',
      swellPeriod: 10, temperature: 24,
      condition: getConditionFromScore(score),
      score: Number(score.toFixed(1)),
      locked: false,
      isFallback: true,
    }
  })
}
