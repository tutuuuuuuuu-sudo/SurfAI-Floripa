// Região que a pessoa mais frequenta (09/out/2026, ideia do usuário): as melhores janelas da aba
// Previsão abrem nela, sem esconder a ilha toda. Sinais, do mais forte pro mais fraco: sessões
// registradas (3 pontos cada), praias favoritas (2) e páginas de praia abertas neste aparelho nos
// últimos 30 dias (1). A região escolhida nas Configurações manda sobre tudo. Sem GPS: o pedido de
// permissão assusta, e a localização diz onde a pessoa mora, não onde ela surfa.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { BEACH_REGISTRY } from '../../api/_beachRegistry'

export type Region = 'Norte' | 'Centro' | 'Sul'
const REGIONS: Region[] = ['Norte', 'Centro', 'Sul']
const VISITS_KEY = 'beach_visits'
const VISIT_WINDOW_MS = 30 * 86_400_000
const MIN_POINTS = 3

const regionOf = (beachId: string): Region | undefined =>
  BEACH_REGISTRY.find(b => b.id === beachId)?.region as Region | undefined

// Conta uma visita à página da praia (só neste aparelho, nada vai pro servidor)
export function recordBeachVisit(beachId: string, now = Date.now()) {
  try {
    const all = JSON.parse(localStorage.getItem(VISITS_KEY) ?? '{}') as Record<string, number[]>
    const recent = (all[beachId] ?? []).filter(t => now - t < VISIT_WINDOW_MS)
    // uma visita por hora no máximo, pra recarregar a página não contar várias vezes
    if (recent.length && now - recent[recent.length - 1] < 60 * 60 * 1000) return
    all[beachId] = [...recent, now].slice(-50)
    localStorage.setItem(VISITS_KEY, JSON.stringify(all))
  } catch { /* sem armazenamento: só não conta */ }
}

export function readBeachVisits(now = Date.now()): Record<string, number> {
  try {
    const all = JSON.parse(localStorage.getItem(VISITS_KEY) ?? '{}') as Record<string, number[]>
    return Object.fromEntries(Object.entries(all).map(([id, ts]) => [id, ts.filter(t => now - t < VISIT_WINDOW_MS).length]))
  } catch {
    return {}
  }
}

export interface HomeRegion { region: Region; reason: string }

export function inferHomeRegion(signals: {
  chosen?: string | null
  sessionBeachIds: string[]
  favoriteIds: string[]
  visits: Record<string, number>
}): HomeRegion | null {
  if (signals.chosen && (REGIONS as string[]).includes(signals.chosen)) {
    return { region: signals.chosen as Region, reason: 'escolhida nas Configurações' }
  }
  const points: Record<Region, { total: number; sessions: number; favorites: number; visits: number }> = {
    Norte: { total: 0, sessions: 0, favorites: 0, visits: 0 },
    Centro: { total: 0, sessions: 0, favorites: 0, visits: 0 },
    Sul: { total: 0, sessions: 0, favorites: 0, visits: 0 },
  }
  const add = (beachId: string, weight: number, kind: 'sessions' | 'favorites' | 'visits') => {
    const r = regionOf(beachId)
    if (!r) return
    points[r].total += weight
    points[r][kind] += weight
  }
  signals.sessionBeachIds.forEach(id => add(id, 3, 'sessions'))
  signals.favoriteIds.forEach(id => add(id, 2, 'favorites'))
  Object.entries(signals.visits).forEach(([id, n]) => add(id, n, 'visits'))

  const ranked = [...REGIONS].sort((a, b) => points[b].total - points[a].total)
  const [top, second] = ranked
  // empate ou pouco sinal: ilha toda
  if (points[top].total < MIN_POINTS || points[top].total === points[second].total) return null
  const p = points[top]
  const why = [
    p.sessions ? 'suas sessões' : null,
    p.favorites ? 'suas favoritas' : null,
    p.visits ? 'praias que você mais abre' : null,
  ].filter((w): w is string => w !== null)
  const joined = why.length > 1 ? `${why.slice(0, -1).join(', ')} e ${why[why.length - 1]}` : why[0]
  return { region: top, reason: `pelas ${joined}` }
}

// Junta os sinais da pessoa logada (sessões, favoritas, região escolhida) com as visitas do aparelho
export function useHomeRegion(userId: string | undefined, favoriteIds: string[] | null): HomeRegion | null | undefined {
  const [result, setResult] = useState<HomeRegion | null | undefined>(undefined)
  const favKey = favoriteIds?.join() ?? null
  useEffect(() => {
    if (!userId || favoriteIds === null) return
    let cancelled = false
    ;(async () => {
      const [sessionsRes, prefsRes] = await Promise.all([
        supabase.from('surf_sessions').select('beach_id').eq('user_id', userId).limit(200),
        supabase.from('user_preferences').select('pref_region').eq('user_id', userId).maybeSingle(),
      ])
      if (cancelled) return
      let chosen: string | null = prefsRes.data?.pref_region ?? null
      if (!chosen) { try { chosen = JSON.parse(localStorage.getItem('pref_region') ?? 'null') } catch { /* */ } }
      setResult(inferHomeRegion({
        chosen,
        sessionBeachIds: (sessionsRes.data ?? []).map(s => s.beach_id as string),
        favoriteIds,
        visits: readBeachVisits(),
      }))
    })()
    return () => { cancelled = true }
  }, [userId, favKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return result
}
