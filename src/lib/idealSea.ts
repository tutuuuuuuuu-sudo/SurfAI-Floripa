// "Seu mar ideal" (Premium, 09/out/2026): o app cruza as estrelas que a pessoa deu nas sessões com
// o mar daquela hora e aprende do que ela gosta — tamanho de onda, vento, maré e praias. Depois
// procura nos 14 dias a próxima vez que esse mar aparece.
import type { SurfSession } from './sessions'
import type { BeachForecast, BeachWindow } from './forecastWindows'
import { directionName } from './directions'

export const IDEAL_MIN_SESSIONS = 5
const LIKED_RATING = 4
// Vento fraco não estraga o mar de nenhuma direção; acima disso só vale a direção que já deu certo
const LIGHT_WIND = 8

export interface IdealSea {
  waveMin: number
  waveMax: number
  maxWind: number
  windDirections: string[]
  tideTrend: 'enchendo' | 'secando' | null
  beaches: { id: string; name: string; count: number }[]
  basedOn: number
}

export type IdealSeaStatus =
  | { state: 'learning'; rated: number; needed: number }
  | { state: 'no-likes'; rated: number }
  | { state: 'ready'; ideal: IdealSea }

const floor1 = (n: number) => Math.floor(n * 10 + 1e-9) / 10
const ceil1 = (n: number) => Math.ceil(n * 10 - 1e-9) / 10

export function learnIdealSea(sessions: SurfSession[]): IdealSeaStatus {
  const usable = sessions.filter(s => s.rating && s.wave_height != null)
  if (usable.length < IDEAL_MIN_SESSIONS) {
    return { state: 'learning', rated: usable.length, needed: IDEAL_MIN_SESSIONS - usable.length }
  }
  const liked = usable.filter(s => (s.rating ?? 0) >= LIKED_RATING)
  if (liked.length < 2) return { state: 'no-likes', rated: usable.length }

  const waves = liked.map(s => s.wave_height as number)
  const winds = liked.filter(s => s.wind_speed != null)
  const strongDirs = [...new Set(winds.filter(s => (s.wind_speed as number) > LIGHT_WIND && s.wind_direction).map(s => s.wind_direction as string))]

  const tides = liked.map(s => s.tide_trend).filter((t): t is string => t === 'enchendo' || t === 'secando')
  const rising = tides.filter(t => t === 'enchendo').length
  const tideTrend = tides.length >= 2 && rising / tides.length >= 0.7 ? 'enchendo'
    : tides.length >= 2 && (tides.length - rising) / tides.length >= 0.7 ? 'secando' : null

  const byBeach = new Map<string, { id: string; name: string; count: number }>()
  for (const s of liked) {
    const b = byBeach.get(s.beach_id) ?? { id: s.beach_id, name: s.beach_name, count: 0 }
    b.count++
    byBeach.set(s.beach_id, b)
  }

  return {
    state: 'ready',
    ideal: {
      waveMin: floor1(Math.min(...waves) * 0.9),
      waveMax: ceil1(Math.max(...waves) * 1.1),
      maxWind: Math.max(LIGHT_WIND, ...winds.map(s => s.wind_speed as number)),
      windDirections: strongDirs,
      tideTrend,
      beaches: [...byBeach.values()].sort((a, b) => b.count - a.count).slice(0, 3),
      basedOn: liked.length,
    },
  }
}

export function matchesIdealSea(
  ideal: IdealSea,
  day: { waveHeight: number; windSpeed: number; windDirection: string; tideTrend: string | null; score: number }
): boolean {
  if (day.score < 5) return false
  if (day.waveHeight < ideal.waveMin || day.waveHeight > ideal.waveMax) return false
  const windOk = day.windSpeed <= LIGHT_WIND
    || (ideal.windDirections.includes(day.windDirection) && day.windSpeed <= ideal.maxWind + 3)
  if (!windOk) return false
  // maré desconhecida não reprova
  if (ideal.tideTrend && (day.tideTrend === 'enchendo' || day.tideTrend === 'secando') && day.tideTrend !== ideal.tideTrend) return false
  return true
}

// Primeiro dia em que o mar ideal aparece; no mesmo dia, as praias da pessoa vêm antes
export function findNextIdealSea(ideal: IdealSea, beaches: BeachForecast[]): BeachWindow | null {
  const favorite = new Set(ideal.beaches.map(b => b.id))
  const candidates: BeachWindow[] = []
  for (const b of beaches) {
    for (const day of b.days) {
      if (matchesIdealSea(ideal, day)) candidates.push({ beachId: b.id, beachName: b.name, day })
    }
  }
  candidates.sort((a, b) =>
    a.day.dayIndex - b.day.dayIndex
    || Number(favorite.has(b.beachId)) - Number(favorite.has(a.beachId))
    || b.day.score - a.day.score)
  return candidates[0] ?? null
}

export function describeIdealSea(ideal: IdealSea): { wave: string; wind: string; tide: string; beaches: string } {
  const dirs = ideal.windDirections.map(d => `${d} ${directionName(d)}`)
  return {
    wave: `Onda de ${ideal.waveMin.toFixed(1)} a ${ideal.waveMax.toFixed(1)}m`,
    wind: dirs.length
      ? `Vento fraco, ou ${dirs.join(', ')} até ${ideal.maxWind} km/h`
      : `Vento fraco, até ${LIGHT_WIND} km/h`,
    tide: ideal.tideTrend ? `Maré ${ideal.tideTrend}` : 'Qualquer maré',
    beaches: ideal.beaches.map(b => b.name).join(', '),
  }
}
