// Resumo dos 14 dias das 14 praias (api/forecast-windows.ts) e as contas em cima dele:
// melhores janelas da quinzena (aba Previsão) e a próxima vez que o "seu mar ideal" aparece
// (Sessões, src/lib/idealSea.ts).
import type { BeachDay, BeachForecast } from '../../api/_beachDayTypes'
import { supabase } from './supabase'

export type { BeachDay, BeachForecast }

// Do 8º dia em diante a previsão vira tendência (o chat e a aba Previsão tratam igual)
export const TREND_FROM_DAY = 7

export interface IslandWindows {
  isPremium: boolean
  days: number
  today: string
  beaches: BeachForecast[]
}

const CACHE_MS = 15 * 60 * 1000
const cache = new Map<string, { at: number; data: IslandWindows }>()

export async function fetchIslandWindows(isPremium: boolean): Promise<IslandWindows | null> {
  // Chave com o plano: quem vira Premium não pode ficar preso nos 3 dias guardados antes
  const key = String(isPremium)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const headers: Record<string, string> = {}
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
    const res = await fetch('/api/forecast-windows', { headers })
    if (!res.ok) return null
    const data = await res.json() as IslandWindows
    cache.set(key, { at: Date.now(), data })
    return data
  } catch {
    return null
  }
}

export interface BeachWindow {
  beachId: string
  beachName: string
  day: BeachDay
}

// As melhores janelas: a maior nota de cada dia (uma praia por dia, pra não repetir o mesmo
// dia três vezes), e dessas as `count` maiores, em ordem de data. Só entra janela boa (≥ 5,5), e
// no máximo uma do 8º dia em diante (tendência, a previsão que mais muda).
export function pickBestWindows(beaches: BeachForecast[], count = 3, minScore = 5.5, maxTrend = 1): BeachWindow[] {
  const bestByDay = new Map<number, BeachWindow>()
  for (const b of beaches) {
    for (const day of b.days) {
      const cur = bestByDay.get(day.dayIndex)
      if (!cur || day.score > cur.day.score) bestByDay.set(day.dayIndex, { beachId: b.id, beachName: b.name, day })
    }
  }
  let trend = 0
  return [...bestByDay.values()]
    .filter(w => w.day.score >= minScore)
    .sort((a, b) => b.day.score - a.day.score || a.day.dayIndex - b.day.dayIndex)
    .filter(w => w.day.dayIndex < TREND_FROM_DAY || trend++ < maxTrend)
    .slice(0, count)
    .sort((a, b) => a.day.dayIndex - b.day.dayIndex)
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function dayName(day: Pick<BeachDay, 'date' | 'dayIndex'>): string {
  if (day.dayIndex === 0) return 'Hoje'
  if (day.dayIndex === 1) return 'Amanhã'
  const d = new Date(`${day.date}T12:00:00`)
  return `${WEEKDAYS[d.getDay()]} ${day.date.slice(8, 10)}`
}

export function windowLabel(day: Pick<BeachDay, 'windowStart' | 'windowEnd'>): string {
  return day.windowEnd > day.windowStart ? `${day.windowStart}h–${day.windowEnd}h` : `${day.windowStart}h`
}
