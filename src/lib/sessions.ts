// Diário de sessões (tabela surf_sessions). Desde 09/out/2026 cada sessão guarda a hora em que a
// pessoa entrou e o mar daquela hora, preenchido pelo app (api/session-conditions.ts) — base do
// "seu mar ideal" (idealSea.ts), das conquistas (sessionStats.ts) e do cartão pro story.
import { supabase } from './supabase'
import { captureError } from './monitoring'

export interface SessionConditions {
  waveHeight: number | null
  windSpeed: number | null
  windDirection: string | null
  swellPeriod: number | null
  score: number | null
  tideTrend: string | null
}

export interface SurfSession {
  id: string
  beach_id: string
  beach_name: string
  date: string
  start_hour: number | null
  duration_minutes: number | null
  rating: number | null
  notes: string | null
  wave_height: number | null
  wind_speed: number | null
  wind_direction: string | null
  swell_period: number | null
  app_score: number | null
  tide_trend: string | null
  created_at: string
}

export const STAR_LABELS = ['', 'Ruim', 'Regular', 'Bom', 'Excelente', 'Épico']

export async function loadSessions(userId: string): Promise<SurfSession[] | null> {
  const { data, error } = await supabase
    .from('surf_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('start_hour', { ascending: false, nullsFirst: false })
    .limit(500)
  if (error) {
    if (error.code !== '42P01') captureError(error, { context: 'sessions.load', code: error.code })
    return null
  }
  // numeric do Postgres chega como texto
  return (data ?? []).map(s => ({
    ...s,
    wave_height: s.wave_height == null ? null : Number(s.wave_height),
    app_score: s.app_score == null ? null : Number(s.app_score),
  })) as SurfSession[]
}

export async function fetchSessionConditions(beachId: string, date: string, hour: number): Promise<SessionConditions | null> {
  try {
    const res = await fetch(`/api/session-conditions?${new URLSearchParams({ beachId, date, hour: String(hour) })}`)
    if (!res.ok) return null
    const data = await res.json() as ({ found: true } & SessionConditions) | { found: false }
    return data.found ? data : null
  } catch {
    return null
  }
}

export interface NewSession {
  beachId: string
  beachName: string
  date: string
  startHour: number
  durationMinutes: number
  rating: number
  notes: string
  conditions: SessionConditions | null
}

export async function saveSession(userId: string, s: NewSession): Promise<SurfSession | null> {
  const { data, error } = await supabase.from('surf_sessions').insert({
    user_id: userId,
    beach_id: s.beachId,
    beach_name: s.beachName,
    date: s.date,
    start_hour: s.startHour,
    duration_minutes: s.durationMinutes || null,
    rating: s.rating || null,
    notes: s.notes.trim() || null,
    wave_height: s.conditions?.waveHeight ?? null,
    wind_speed: s.conditions?.windSpeed ?? null,
    wind_direction: s.conditions?.windDirection ?? null,
    swell_period: s.conditions?.swellPeriod ?? null,
    app_score: s.conditions?.score ?? null,
    tide_trend: s.conditions?.tideTrend ?? null,
  }).select('*').single()
  if (error) {
    captureError(error, { context: 'sessions.save', code: error.code })
    return null
  }
  return { ...data, wave_height: data.wave_height == null ? null : Number(data.wave_height), app_score: data.app_score == null ? null : Number(data.app_score) } as SurfSession
}

export async function deleteSession(userId: string, id: string): Promise<boolean> {
  const { error } = await supabase.from('surf_sessions').delete().eq('id', id).eq('user_id', userId)
  return !error
}

export async function hasSessionOn(userId: string, date: string): Promise<boolean> {
  const { count } = await supabase
    .from('surf_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('date', date)
  return (count ?? 0) > 0
}

export function formatDuration(minutes: number | null): string {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}
