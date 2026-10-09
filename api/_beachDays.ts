// Os 14 dias das 14 praias, um resumo por dia (melhor horário, melhor janela, onda, vento, maré).
// Fonte única do chat (api/_chatForecast.ts monta o texto em cima disto) e da aba Previsão
// (api/forecast-windows.ts: melhores janelas da quinzena e "seu mar ideal" das Sessões).
// Montar custa 14 praias × 3 chamadas na Open-Meteo, por isso fica 1 h no cache do Supabase.
// Prefixo _ = não exposto como endpoint HTTP pelo Vercel.

import { fetchHourlyForecast, type HourReading } from './_hourlyForecast.js'
import { fetchTideData } from './_tide.js'
import { computeGoldenWindow } from './_goldenWindow.js'
import { BEACH_REGISTRY } from './_beachRegistry.js'
import { getCachedJson, setCachedJson } from './_cache.js'
import { todaySP, nowHourSP } from '../src/lib/timeSP.js'
import type { BeachDay, BeachForecast } from './_beachDayTypes.js'

export type { BeachDay, BeachForecast }

export const ISLAND_FORECAST_DAYS = 14

export interface Tide { heights: number[]; times: string[] }

// Enchendo/secando numa hora específica (compara com a hora seguinte)
export function tideTrendAt(tide: Tide | null, date: string, hour: number): string | null {
  if (!tide) return null
  const key = `${date}T${String(hour).padStart(2, '0')}:00`
  const i = tide.times.indexOf(key)
  if (i < 0 || i + 1 >= tide.heights.length) return null
  const diff = tide.heights[i + 1] - tide.heights[i]
  return diff > 0.02 ? 'enchendo' : diff < -0.02 ? 'secando' : 'parada (virando)'
}

export interface IslandForecast {
  today: string
  nowHour: number
  beaches: BeachForecast[]
  tide: Tide | null
}

export interface HourRow extends HourReading { hour: number }

export function summarizeDay(
  date: string,
  dayIndex: number,
  hours: HourRow[],
  sunrise: number,
  sunset: number,
  tideTrend: (hour: number) => string | null
): BeachDay | null {
  const daylight = hours.filter(h => h.hour >= sunrise && h.hour <= sunset)
  if (daylight.length === 0) return null
  const best = daylight.reduce((a, b) => (b.score > a.score ? b : a))
  const gw = computeGoldenWindow(
    daylight.map(h => ({ ...h, label: `${h.hour}h` })), best.hour, sunrise, sunset
  )
  const waves = daylight.map(h => h.waveHeight)
  const hasWindow = gw && gw.endHour > gw.startHour
  return {
    date, dayIndex,
    score: Number(best.score.toFixed(1)),
    bestHour: best.hour,
    windowStart: hasWindow ? gw.startHour : best.hour,
    windowEnd: hasWindow ? gw.endHour : best.hour,
    waveMin: Math.min(...waves),
    waveMax: Math.max(...waves),
    waveHeight: best.waveHeight,
    windSpeed: Math.round(best.windSpeed),
    windDirection: best.windDirection,
    swellPeriod: Math.round(best.swellPeriod),
    tideTrend: tideTrend(best.hour),
  }
}

const daysBetween = (from: string, to: string) =>
  Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000)

async function buildIslandForecast(): Promise<IslandForecast> {
  const today = todaySP()
  const nowHour = nowHourSP()
  const tide = await fetchTideData(ISLAND_FORECAST_DAYS + 1)

  const beaches = await Promise.all(
    BEACH_REGISTRY.map(async (beach): Promise<BeachForecast | null> => {
      // try/catch por praia: uma chamada malformada da Open-Meteo só perde essa praia
      try {
        const hourly = await fetchHourlyForecast(String(beach.lat), String(beach.lng), ISLAND_FORECAST_DAYS)
        if (!hourly || hourly.times.length === 0) return null
        const firstDate = hourly.times[0].slice(0, 10)

        const byDate = new Map<string, HourRow[]>()
        hourly.times.forEach((t, i) => {
          const date = t.slice(0, 10), hour = Number(t.slice(11, 13))
          if (date < today) return
          if (date === today && hour < nowHour) return // hoje: só o que ainda vem pela frente
          const r = hourly.readHour(i, beach.orientation)
          if (!r) return
          const list = byDate.get(date) ?? []
          list.push({ ...r, hour })
          byDate.set(date, list)
        })

        const days = Array.from(byDate.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, hours]) => {
            const sun = hourly.sunFor(daysBetween(firstDate, date))
            return summarizeDay(date, daysBetween(today, date), hours, sun.sunriseHour ?? 6, sun.sunsetHour ?? 18,
              h => tideTrendAt(tide, date, h))
          })
          .filter((d): d is BeachDay => d !== null)
        return days.length ? { id: beach.id, name: beach.name, region: beach.region, days } : null
      } catch (err) {
        console.error(`[beachDays] previsão falhou pra ${beach.name}:`, err)
        return null
      }
    })
  )

  return { today, nowHour, beaches: beaches.filter((b): b is BeachForecast => b !== null), tide }
}

const CACHE_KEY = 'forecast:island-14d-v1'
const CACHE_TTL_MS = 60 * 60 * 1000

export async function getIslandForecast(): Promise<IslandForecast> {
  const cached = await getCachedJson<IslandForecast>(CACHE_KEY, CACHE_TTL_MS)
  if (cached && cached.today === todaySP() && cached.beaches.length > 0) return cached
  const fresh = await buildIslandForecast()
  if (fresh.beaches.length > 0) await setCachedJson(CACHE_KEY, fresh)
  return fresh
}
