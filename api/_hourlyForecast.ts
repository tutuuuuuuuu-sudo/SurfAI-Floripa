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
  // Hora (0-23) do nascer/pôr do sol de hoje, no fuso de Floripa — usado por hourly.ts pra
  // nunca sugerir "melhor janela" fora do horário de luz do dia (achado 24/ago/2026: o
  // cálculo original não olhava luz do dia nenhuma, chegou a recomendar "melhor janela:
  // 21h às 23h"). `null` se a Open-Meteo não retornar o dado (fail-open — sem filtro).
  sunriseHour: number | null
  sunsetHour: number | null
  readHour(idx: number, orientation: number): HourReading | null
}

interface DailySunTimes {
  sunrise?: string[]
  sunset?: string[]
}

// Extrai só a hora (0-23) de um horário ISO local tipo "2026-08-24T06:35".
function isoHour(iso: string | undefined): number | null {
  if (!iso) return null
  const hourPart = iso.split('T')[1]?.slice(0, 2)
  const hour = hourPart ? parseInt(hourPart, 10) : NaN
  return Number.isNaN(hour) ? null : hour
}

// Retorna null se alguma das duas chamadas ao Open-Meteo falhar.
export async function fetchHourlyForecast(
  lat: string,
  lng: string,
  forecastDays: number
): Promise<HourlyForecast | null> {
  const [marineRes, marineEcmwfRes, weatherRes] = await Promise.all([
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}` +
      `&hourly=wave_height,wave_period,swell_wave_height,swell_wave_period,swell_wave_direction` +
      `&length_unit=metric&timezone=America%2FSao_Paulo&forecast_days=${forecastDays}`
    ),
    // models=ecmwf_wam (28/ago/2026, ver comentário de MODEL_BIAS_CORRECTION em
    // _liveConditions.ts pro histórico completo): pede a altura de onda do modelo ECMWF
    // direto — o mesmo modelo que Windy.com/Surfline/Surfguru/Waves mostram, em vez do
    // modelo padrão (classe GFS, sistematicamente mais baixo). Chamada separada porque
    // ecmwf_wam sozinho só retorna wave_height/wave_period (a onda combinada) — período e
    // direção de swell continuam vindo da chamada padrão acima, que os calcula.
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}` +
      `&hourly=wave_height&length_unit=metric&timezone=America%2FSao_Paulo` +
      `&forecast_days=${forecastDays}&models=ecmwf_wam`
    ),
    // daily=sunrise,sunset na MESMA chamada que já busca vento/temperatura hora a hora —
    // sem round-trip extra pro nascer/pôr do sol.
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&hourly=wind_speed_10m,wind_direction_10m,temperature_2m&daily=sunrise,sunset` +
      `&wind_speed_unit=kmh&timezone=America%2FSao_Paulo&forecast_days=${forecastDays}`
    ),
  ])

  if (!marineRes.ok || !marineEcmwfRes.ok || !weatherRes.ok) return null

  const marine = await marineRes.json() as { hourly?: MarineHourly }
  const marineEcmwf = await marineEcmwfRes.json() as { hourly?: { wave_height?: number[] } }
  const weather = await weatherRes.json() as { hourly?: WeatherHourly; daily?: DailySunTimes }
  const times = marine.hourly?.time ?? []
  const sunriseHour = isoHour(weather.daily?.sunrise?.[0])
  const sunsetHour = isoHour(weather.daily?.sunset?.[0])

  function readHour(idx: number, orientation: number): HourReading | null {
    if (idx < 0 || idx >= times.length) return null
    // wave_height (ecmwf_wam) é a altura combinada (wind waves + swell) do modelo certo —
    // fallback pro modelo padrão só se vier vazio pra esse índice.
    const rawWaveHeight = Number(
      (marineEcmwf.hourly?.wave_height?.[idx] ?? marine.hourly?.wave_height?.[idx] ?? marine.hourly?.swell_wave_height?.[idx] ?? 1.0).toFixed(1)
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

  return { times, sunriseHour, sunsetHour, readHour }
}
