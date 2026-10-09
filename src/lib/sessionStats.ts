// Conquistas do diário que não dependem de outros usuários (09/out/2026): números do mês,
// semanas seguidas surfando, passaporte das 14 praias e a retrospectiva do ano.
import type { SurfSession } from './sessions'

export function monthSummary(sessions: SurfSession[], today: string) {
  const month = today.slice(0, 7)
  const inMonth = sessions.filter(s => s.date.startsWith(month))
  return { count: inMonth.length, minutes: inMonth.reduce((acc, s) => acc + (s.duration_minutes ?? 0), 0) }
}

// Segunda-feira da semana da data (as semanas do streak começam na segunda)
function weekStart(date: string): string {
  const d = new Date(`${date}T12:00:00Z`)
  const offset = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - offset)
  return d.toISOString().slice(0, 10)
}

function previousWeek(monday: string): string {
  const d = new Date(`${monday}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 7)
  return d.toISOString().slice(0, 10)
}

// Semanas seguidas com pelo menos uma sessão. A semana atual ainda sem sessão não quebra a
// sequência (a pessoa ainda pode surfar até domingo): conta a partir da semana passada.
export function weekStreak(sessions: SurfSession[], today: string): number {
  const weeks = new Set(sessions.map(s => weekStart(s.date)))
  let week = weekStart(today)
  if (!weeks.has(week)) week = previousWeek(week)
  let streak = 0
  while (weeks.has(week)) {
    streak++
    week = previousWeek(week)
  }
  return streak
}

export function surfedBeaches(sessions: SurfSession[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const s of sessions) out.set(s.beach_id, (out.get(s.beach_id) ?? 0) + 1)
  return out
}

export function yearRecap(sessions: SurfSession[], year: string) {
  const inYear = sessions.filter(s => s.date.startsWith(year))
  const beaches = surfedBeaches(inYear)
  const [favId, favCount] = [...beaches.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0]
  // melhor sessão: mais estrelas; empate, a de nota do app maior
  const best = [...inYear].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.app_score ?? 0) - (a.app_score ?? 0))[0] ?? null
  return {
    count: inYear.length,
    minutes: inYear.reduce((acc, s) => acc + (s.duration_minutes ?? 0), 0),
    beachCount: beaches.size,
    favorite: favId ? { name: inYear.find(s => s.beach_id === favId)!.beach_name, count: favCount } : null,
    best,
  }
}
