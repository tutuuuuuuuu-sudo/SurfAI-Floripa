// Busca de previsão hora a hora (Open-Meteo) — fonte única usada por forecast.ts e hourly.ts.
// Prefixo _ indica que não é um handler HTTP — não será exposto como endpoint pelo Vercel.

import { calculateSurfScore, applyDirectionalExposure } from './_scoreEngine.js'

export function degreesToDir(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]
}

export interface HourReading {
  waveHeight: number
  swellPeriod: number
  windSpeed: number
  windDirection: string
  temperature: number
  score: number
}

interface MarineHourly {
  time: string[]
  wave_height?: number[]
  wave_period?: number[]
  swell_wave_height?: number[]
  swell_wave_period?: number[]
  swell_wave_direction?: number[]
}
interface WeatherHourly {
  wind_speed_10m?: number[]
  wind_direction_10m?: number[]
  temperature_2m?: number[]
}

export interface HourlyForecast {
  times: string[]
  readHour(idx: number, orientation: number): HourReading | null
}

// Retorna null se alguma das duas chamadas ao Open-Meteo falhar.
export async function fetchHourlyForecast(
  lat: string,
  lng: string,
  forecastDays: number
): Promise<HourlyForecast | null> {
  const [marineRes, weatherRes] = await Promise.all([
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}` +
      `&hourly=wave_height,wave_period,swell_wave_height,swell_wave_period,swell_wave_direction` +
      `&length_unit=metric&timezone=America%2FSao_Paulo&forecast_days=${forecastDays}`
    ),
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&hourly=wind_speed_10m,wind_direction_10m,temperature_2m` +
      `&wind_speed_unit=kmh&timezone=America%2FSao_Paulo&forecast_days=${forecastDays}`
    ),
  ])

  if (!marineRes.ok || !weatherRes.ok) return null

  const marine = await marineRes.json() as { hourly?: MarineHourly }
  const weather = await weatherRes.json() as { hourly?: WeatherHourly }
  const times = marine.hourly?.time ?? []

  function readHour(idx: number, orientation: number): HourReading | null {
    if (idx < 0 || idx >= times.length) return null
    // wave_height é a altura combinada (wind waves + swell) — swell_wave_height sozinho é só
    // o componente de swell, sempre menor ou igual ao total. Prioridade estava invertida
    // (achado 24/ago/2026, mesmo problema do fetchOpenMeteo em _liveConditions.ts).
    const rawWaveHeight = Number(
      (marine.hourly?.wave_height?.[idx] ?? marine.hourly?.swell_wave_height?.[idx] ?? 1.0).toFixed(1)
    )
    const swellDirection = degreesToDir(marine.hourly?.swell_wave_direction?.[idx] ?? 180)
    // Mesma correção de exposição direcional aplicada em surf.ts — sem isso, a mesma
    // praia no mesmo instante podia mostrar nota diferente na Home vs na Previsão
    // (achado crítico da auditoria de 22/ago/2026).
    const waveHeight = applyDirectionalExposure(rawWaveHeight, swellDirection, orientation)
    const swellPeriod = Math.round(
      marine.hourly?.swell_wave_period?.[idx] ?? marine.hourly?.wave_period?.[idx] ?? 10
    )
    const windSpeed = Math.round(weather.hourly?.wind_speed_10m?.[idx] ?? 12)
    const windDirection = degreesToDir(weather.hourly?.wind_direction_10m?.[idx] ?? 0)
    const temperature = Math.round(weather.hourly?.temperature_2m?.[idx] ?? 24)
    const score = calculateSurfScore(waveHeight, windSpeed, swellPeriod, windDirection, orientation)
    return { waveHeight, swellPeriod, windSpeed, windDirection, temperature, score }
  }

  return { times, readHour }
}
