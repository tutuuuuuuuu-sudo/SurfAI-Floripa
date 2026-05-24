// Reexporta de weatherApi para manter compatibilidade com imports existentes
export { getRealTide, getRealWaterTemp } from './weatherApi'

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

function calculateForecastScore(wave: number, wind: number, period: number): number {
  let score = 5
  if (wave >= 1.5) score += 2
  else if (wave >= 1.0) score += 1.5
  else if (wave >= 0.8) score += 1
  else score -= 1
  if (wind <= 10) score += 2
  else if (wind <= 15) score += 1
  else score -= 1
  if (period >= 12) score += 2
  else if (period >= 10) score += 1
  else if (period < 8) score -= 1
  return Math.min(10, Math.max(0, score))
}

function getConditionFromScore(score: number): 'Excelente' | 'Bom' | 'Regular' | 'Ruim' {
  if (score >= 8) return 'Excelente'
  if (score >= 6.5) return 'Bom'
  if (score >= 5) return 'Regular'
  return 'Ruim'
}

// Converte graus para código de direção limpo (N, SE, SW etc)
function degreesToDir(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

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

// Quantos dias mostrar sem bloqueio para usuário free
const FREE_DAYS = 3

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
  isPremium = false
): Promise<WeatherForecast[]> {
  const now = Date.now()
  if (forecastCache[spotId] && (now - forecastCache[spotId].time) < CACHE_DURATION) {
    const cached = [...forecastCache[spotId].data]
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
    const [marineRes, weatherRes] = await Promise.all([
      fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${coords.lat}&longitude=${coords.lng}&daily=wave_height_max,wave_period_max,swell_wave_height_max,swell_wave_period_max&length_unit=metric&timezone=America%2FSao_Paulo`),
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&hourly=temperature_2m&daily=wind_speed_10m_max,wind_direction_10m_dominant,temperature_2m_max&wind_speed_unit=kmh&timezone=America%2FSao_Paulo`)
    ])

    interface MarineDaily { time: string[]; wave_height_max?: number[]; wave_period_max?: number[]; swell_wave_height_max?: number[]; swell_wave_period_max?: number[] }
    interface WeatherDaily { wind_speed_10m_max?: number[]; wind_direction_10m_dominant?: number[]; temperature_2m_max?: number[] }
    const marine = await marineRes.json() as { daily?: MarineDaily }
    const weather = await weatherRes.json() as { daily?: WeatherDaily; hourly?: { temperature_2m: number[] } }

    const days = marine.daily?.time ?? []
    const forecasts: WeatherForecast[] = []
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

    for (let i = 0; i < Math.min(7, days.length); i++) {
      const date = new Date(days[i] + 'T12:00:00')
      const dayName = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : dayNames[date.getDay()]

      let waveHeight: number, windSpeed: number, swellPeriod: number, temperature: number, score: number

      const currentHour = new Date().getHours()
      const hourlyTemps: number[] = weather.hourly?.temperature_2m ?? []
      const hourIdx = i === 0 ? currentHour : i * 24 + 12
      const hourlyTemp = hourlyTemps[hourIdx] != null ? Math.round(hourlyTemps[hourIdx]) : null

      if (i === 0 && currentConditions) {
        waveHeight = currentConditions.waveHeight
        windSpeed = currentConditions.windSpeed
        swellPeriod = currentConditions.swellPeriod
        temperature = hourlyTemp ?? Math.round(weather.daily?.temperature_2m_max?.[i] ?? 24)
        score = currentConditions.score
      } else {
        waveHeight = Number((marine.daily?.swell_wave_height_max?.[i] ?? marine.daily?.wave_height_max?.[i] ?? 1.0).toFixed(1))
        swellPeriod = Math.round(marine.daily?.swell_wave_period_max?.[i] ?? marine.daily?.wave_period_max?.[i] ?? 10)
        windSpeed = Math.round(weather.daily?.wind_speed_10m_max?.[i] ?? 12)
        temperature = Math.round(weather.daily?.temperature_2m_max?.[i] ?? 24)
        score = calculateForecastScore(waveHeight, windSpeed, swellPeriod)
      }

      const windDeg = weather.daily?.wind_direction_10m_dominant?.[i] ?? 0
      const windDirection = degreesToDir(windDeg)

      forecasts.push({
        date: days[i],
        dayName,
        waveHeight,
        windSpeed,
        windDirection,
        swellPeriod,
        temperature,
        condition: getConditionFromScore(score),
        score: Number(score.toFixed(1)),
        locked: false,
      })
    }

    forecastCache[spotId] = { data: forecasts, time: now }
    return applyPremiumLock(forecasts, isPremium)
  } catch {
    return applyPremiumLock(getFallbackForecast(), isPremium)
  }
}

// Marca dias além do limite free como locked=true
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
    const score = calculateForecastScore(1.0, 12, 10)
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
