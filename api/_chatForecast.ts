// Previsão de 1 semana (hoje + 6 dias) das 14 praias, em texto compacto pro contexto do chat
// com o Surf AI (api/surf-chat.ts). Pedido do usuário 25/set/2026: quando perguntado sobre
// uma praia, o chat tem que priorizar tamanho da onda, maré (enchendo/secando), vento
// (direção + velocidade) e melhor horário do dia — e conseguir responder sobre a semana,
// não só amanhã/depois (o resumo antigo só cobria 2 dias e só altura + nota máxima).
// Prefixo _ indica que não é um handler HTTP — não será exposto como endpoint pelo Vercel.

import { fetchHourlyForecast, type HourReading } from './_hourlyForecast.js'
import { fetchTideData } from './_tide.js'
import { computeGoldenWindow } from './_goldenWindow.js'
import { BEACH_REGISTRY } from './_beachRegistry.js'
import { todaySP, nowHourSP } from '../src/lib/timeSP.js'
import { directionName } from '../src/lib/directions.js'

export const CHAT_FORECAST_DAYS = 7

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const fmtHour = (h: number) => `${String(h).padStart(2, '0')}h`

export function dayLabel(date: string, today: string): string {
  const d = new Date(`${date}T12:00:00`)
  const t = new Date(`${today}T12:00:00`)
  const diff = Math.round((d.getTime() - t.getTime()) / 86_400_000)
  const ddmm = `${date.slice(8, 10)}/${date.slice(5, 7)}`
  if (diff === 0) return `hoje (${WEEKDAYS[d.getDay()]} ${ddmm})`
  if (diff === 1) return `amanhã (${WEEKDAYS[d.getDay()]} ${ddmm})`
  return `${WEEKDAYS[d.getDay()]} ${ddmm}`
}

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

// Horários de maré alta/baixa de cada dia (igual pra toda a ilha — um ponto só de maré)
export function tideEventsByDay(tide: Tide | null): Map<string, string[]> {
  const out = new Map<string, string[]>()
  if (!tide) return out
  const hs = tide.heights
  for (let i = 1; i < hs.length - 1; i++) {
    const date = tide.times[i].slice(0, 10), hour = Number(tide.times[i].slice(11, 13))
    const high = hs[i] >= hs[i - 1] && hs[i] > hs[i + 1]
    const low = hs[i] <= hs[i - 1] && hs[i] < hs[i + 1]
    if (!high && !low) continue
    const list = out.get(date) ?? []
    list.push(`${high ? 'alta' : 'baixa'} ${fmtHour(hour)}`)
    out.set(date, list)
  }
  return out
}

interface HourRow extends HourReading { hour: number }

// Uma linha por dia: "sáb 27/09: onda 0.9-1.3m, melhor horário 07h às 10h (nota 7.4),
// vento 8km/h NW (noroeste), maré enchendo, período 10s"
export function formatBeachDay(
  label: string,
  hours: HourRow[],
  sunrise: number,
  sunset: number,
  tideTrend: (hour: number) => string | null
): string | null {
  const daylight = hours.filter(h => h.hour >= sunrise && h.hour <= sunset)
  if (daylight.length === 0) return null
  const best = daylight.reduce((a, b) => (b.score > a.score ? b : a))
  const gw = computeGoldenWindow(
    daylight.map(h => ({ ...h, label: fmtHour(h.hour) })), best.hour, sunrise, sunset
  )
  const waves = daylight.map(h => h.waveHeight)
  const range = `${Math.min(...waves).toFixed(1)}-${Math.max(...waves).toFixed(1)}m`
  const when = gw && gw.endHour > gw.startHour
    ? `${fmtHour(gw.startHour)} às ${fmtHour(gw.endHour)}`
    : fmtHour(best.hour)
  const trend = tideTrend(best.hour)
  return `${label}: onda ${range}, melhor horário ${when} (nota ${best.score.toFixed(1)}), ` +
    `vento ${Math.round(best.windSpeed)}km/h ${best.windDirection} (${directionName(best.windDirection)})` +
    `${trend ? `, maré ${trend}` : ''}, período ${Math.round(best.swellPeriod)}s`
}

export async function buildWeekForecastSummary(): Promise<string> {
  const today = todaySP()
  const nowHour = nowHourSP()
  const tide = await fetchTideData(CHAT_FORECAST_DAYS + 1)

  const perBeach = await Promise.all(
    BEACH_REGISTRY.map(async beach => {
      // try/catch por praia: uma chamada malformada da Open-Meteo só perde essa praia
      try {
        const hourly = await fetchHourlyForecast(String(beach.lat), String(beach.lng), CHAT_FORECAST_DAYS)
        if (!hourly) return null
        const sunrise = hourly.sunriseHour ?? 6
        const sunset = hourly.sunsetHour ?? 18

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

        const lines = Array.from(byDate.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(0, CHAT_FORECAST_DAYS)
          .map(([date, hours]) =>
            formatBeachDay(dayLabel(date, today), hours, sunrise, sunset, h => tideTrendAt(tide, date, h))
          )
          .filter((l): l is string => l !== null)
        if (lines.length === 0) return null
        return `${beach.name}:\n${lines.map(l => `  ${l}`).join('\n')}`
      } catch (err) {
        console.error(`[chatForecast] previsão falhou pra ${beach.name}:`, err)
        return null
      }
    })
  )

  const tideDays = Array.from(tideEventsByDay(tide).entries())
    .filter(([date]) => date >= today)
    .slice(0, CHAT_FORECAST_DAYS)
    .map(([date, ev]) => `  ${dayLabel(date, today)}: ${ev.join(', ')}`)
  const nowTrend = tideTrendAt(tide, today, nowHour)

  return [
    perBeach.filter((b): b is string => b !== null).join('\n'),
    tideDays.length ? `\nHorários de maré (iguais pra toda a ilha):\n${tideDays.join('\n')}` : '',
    nowTrend ? `Maré agora: ${nowTrend}.` : '',
  ].filter(Boolean).join('\n')
}
