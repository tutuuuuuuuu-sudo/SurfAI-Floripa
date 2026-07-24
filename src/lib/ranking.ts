import { supabase } from './supabase'

export interface RankingEntry {
  userId: string
  userName: string
  count: number
  position: number
}

export interface SpotRanking {
  entries: RankingEntry[]
  currentUser: RankingEntry | null
  monthLabel: string
}

function startOfMonthSP(): string {
  // en-CA formata como YYYY-MM-DD — extrai ano/mês diretamente no fuso de SP,
  // sem passar por new Date(y, m, 1) (que usaria o fuso do runtime, não o de SP).
  const [year, month] = new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    .split('-')
  return `${year}-${month}-01`
}

function monthLabelSP(): string {
  return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', month: 'long', year: 'numeric' })
}

/** Ranking de quem mais confirmou condições reais ("Bateu?") em um pico, no mês corrente */
export async function getSpotRanking(beachId: string): Promise<SpotRanking> {
  const since = startOfMonthSP()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('spot_validations')
    .select('user_id, user_name')
    .eq('beach_id', beachId)
    .gte('validation_date', since)

  if (error || !data) return { entries: [], currentUser: null, monthLabel: monthLabelSP() }

  const counts = new Map<string, { userName: string; count: number }>()
  for (const row of data) {
    const userId = row.user_id as string
    const existing = counts.get(userId)
    if (existing) existing.count += 1
    else counts.set(userId, { userName: row.user_name as string, count: 1 })
  }

  const sorted = [...counts.entries()]
    .map(([userId, v]) => ({ userId, userName: v.userName, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .map((entry, idx) => ({ ...entry, position: idx + 1 }))

  const top10 = sorted.slice(0, 10)
  const currentUser = user ? sorted.find(e => e.userId === user.id) ?? null : null

  return { entries: top10, currentUser: currentUser ?? null, monthLabel: monthLabelSP() }
}

export interface TopContribution {
  beachId: string
  beachName: string
  position: number
  count: number
}

/** Pico onde o usuário logado mais contribuiu com validações este mês (para exibir no Perfil) */
export async function getTopContribution(): Promise<TopContribution | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const since = startOfMonthSP()
  const { data, error } = await supabase
    .from('spot_validations')
    .select('beach_id, beach_name, user_id')
    .gte('validation_date', since)

  if (error || !data || data.length === 0) return null

  // Agrupa por pico, contando validações de todo mundo, para achar a posição do usuário em cada um
  const byBeach = new Map<string, { beachName: string; counts: Map<string, number> }>()
  for (const row of data) {
    const beachId = row.beach_id as string
    if (!byBeach.has(beachId)) byBeach.set(beachId, { beachName: row.beach_name as string, counts: new Map() })
    const entry = byBeach.get(beachId)!
    entry.counts.set(row.user_id as string, (entry.counts.get(row.user_id as string) ?? 0) + 1)
  }

  let best: TopContribution | null = null
  for (const [beachId, { beachName, counts }] of byBeach) {
    const myCount = counts.get(user.id)
    if (!myCount) continue
    const sorted = [...counts.values()].sort((a, b) => b - a)
    const position = sorted.indexOf(myCount) + 1
    if (!best || myCount > best.count) best = { beachId, beachName, position, count: myCount }
  }

  return best
}
