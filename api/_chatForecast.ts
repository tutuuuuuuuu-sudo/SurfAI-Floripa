// Previsão de 1 semana (hoje + 6 dias) das 14 praias, mais a tendência até o 14º dia (09/out/2026,
// ver CHAT_TREND_DAYS), em texto compacto pro contexto do chat
// com o Surf AI (api/surf-chat.ts). Pedido do usuário 25/set/2026: quando perguntado sobre
// uma praia, o chat tem que priorizar tamanho da onda, maré (enchendo/secando), vento
// (direção + velocidade) e melhor horário do dia — e conseguir responder sobre a semana,
// não só amanhã/depois (o resumo antigo só cobria 2 dias e só altura + nota máxima).
// Os dados vêm de api/_beachDays.ts (o mesmo resumo da aba Previsão, 1 h de cache).
// Prefixo _ indica que não é um handler HTTP — não será exposto como endpoint pelo Vercel.

import { getIslandForecast, tideTrendAt, type BeachDay, type Tide } from './_beachDays.js'
import { directionName } from '../src/lib/directions.js'
import { nowHourSP } from '../src/lib/timeSP.js'

export { tideTrendAt }

export const CHAT_FORECAST_DAYS = 7
// 09/out/2026: o chat via só 7 dias e mandava dizer "ainda não tem" pro resto, mas a aba
// Previsão do Premium (o chat é só Premium) mostra 14. O usuário viu nota 10 no Campeche no 10º
// dia e o chat respondeu que o app não tinha esses dias e que a nota era "exagerada". Do 8º ao
// 14º dia vai uma linha curta por praia (onda e nota): a previsão longa muda muito, e o resumo
// detalhado dos 14 dias dobraria o tamanho do contexto (o Groq, reserva da cascata, aceita só
// 6.000 tokens por minuto).
export const CHAT_TREND_DAYS = 14

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

const waveRange = (d: BeachDay) => `${d.waveMin.toFixed(1)}-${d.waveMax.toFixed(1)}m`

// Dia da tendência (8º ao 14º): "sáb 17/10 1.5-2.2m nota 6.3" — sem horário, vento e maré
export function formatTrendDay(label: string, day: BeachDay): string {
  return `${label} ${waveRange(day)} nota ${day.score.toFixed(1)}`
}

// Uma linha por dia: "sáb 27/09: onda 0.9-1.3m, melhor horário 07h às 10h (nota 7.4),
// vento 8km/h NW (noroeste), maré enchendo, período 10s"
export function formatBeachDay(label: string, day: BeachDay): string {
  const when = day.windowEnd > day.windowStart
    ? `${fmtHour(day.windowStart)} às ${fmtHour(day.windowEnd)}`
    : fmtHour(day.bestHour)
  return `${label}: onda ${waveRange(day)}, melhor horário ${when} (nota ${day.score.toFixed(1)}), ` +
    `vento ${day.windSpeed}km/h ${day.windDirection} (${directionName(day.windDirection)})` +
    `${day.tideTrend ? `, maré ${day.tideTrend}` : ''}, período ${day.swellPeriod}s`
}

export async function buildWeekForecastSummary(): Promise<string> {
  const { today, beaches, tide } = await getIslandForecast()

  const perBeach = beaches.map(beach => {
    const lines = beach.days
      .slice(0, CHAT_FORECAST_DAYS)
      .map(d => formatBeachDay(dayLabel(d.date, today), d))
    const trend = beach.days
      .slice(CHAT_FORECAST_DAYS, CHAT_TREND_DAYS)
      .map(d => formatTrendDay(dayLabel(d.date, today), d))
    if (trend.length) lines.push(`tendência dos dias seguintes: ${trend.join(', ')}`)
    return `${beach.name}:\n${lines.map(l => `  ${l}`).join('\n')}`
  })

  const tideDays = Array.from(tideEventsByDay(tide).entries())
    .filter(([date]) => date >= today)
    .slice(0, CHAT_TREND_DAYS)
    .map(([date, ev]) => `  ${dayLabel(date, today)}: ${ev.join(', ')}`)
  // o resumo pode ter até 1 h de cache: a maré de agora sai da hora atual, não da hora em que foi montado
  const nowTrend = tideTrendAt(tide, today, nowHourSP())

  return [
    perBeach.join('\n'),
    tideDays.length ? `\nHorários de maré (iguais pra toda a ilha):\n${tideDays.join('\n')}` : '',
    nowTrend ? `Maré agora: ${nowTrend}.` : '',
  ].filter(Boolean).join('\n')
}
