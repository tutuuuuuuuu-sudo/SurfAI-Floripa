// "Caiu hoje?" por notificação (14/out/2026): a mesma pergunta do cartão da Home
// (src/components/home/SurfedTodayPrompt.tsx), mandada às 19h pra quem tem os alertas ligados e
// não abriu o app. Regras puras aqui (testadas em _sessionReminder.test.ts); o envio fica em
// session-reminder.ts. Prefixo _ = não exposto como endpoint HTTP pelo Vercel.

import { beachMatches, type PushCriteria } from './_pushMatch.js'

// Mesma janela do cartão da Home: de 5h até 1 h antes de agora (quem caiu agora ainda está na água)
export const REMINDER_FROM_HOUR = 5
// Por quanto tempo o serviço de push guarda o aviso com o celular desligado: depois das 22h já
// não faz sentido perguntar "caiu hoje?"
export const REMINDER_TTL_SECONDS = 3 * 3600

export interface SnapshotRow { beach_id: string; beach_name: string; score: number | string; captured_at: string }
export interface DayPeak { beachId: string; beachName: string; score: number; hour: number }

const hourSP = (iso: string) =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date(iso))) % 24

// Melhor hora de cada praia no dia (histórico de hora em hora, score_snapshots). Empate fica com a
// hora mais cedo.
export function peaksByBeach(rows: SnapshotRow[]): DayPeak[] {
  const best = new Map<string, DayPeak>()
  const sorted = [...rows].sort((a, b) => a.captured_at.localeCompare(b.captured_at))
  for (const r of sorted) {
    const score = Number(r.score)
    if (!Number.isFinite(score)) continue
    const current = best.get(r.beach_id)
    if (!current || score > current.score) {
      best.set(r.beach_id, { beachId: r.beach_id, beachName: r.beach_name, score, hour: hourSP(r.captured_at) })
    }
  }
  return [...best.values()]
}

// Praia que o aviso cita: só pergunta se o mar bateu o alerta da própria pessoa em alguma hora do
// dia (nota e "só favoritas" do painel de Alertas) — sem isso viraria notificação todo dia.
// Favoritas primeiro, depois a maior nota.
export function pickReminder(peaks: DayPeak[], sub: PushCriteria, favorites: string[]): DayPeak | null {
  const hits = peaks.filter(p => beachMatches(sub, p.beachId, p.score, favorites))
  if (hits.length === 0) return null
  const isFav = (p: DayPeak) => (favorites.includes(p.beachId) ? 1 : 0)
  return hits.sort((a, b) => isFav(b) - isFav(a) || b.score - a.score)[0]
}

// Toque no aviso abre o Diário já com a praia, o dia e a hora preenchidos (SurfLog.tsx lê esses
// parâmetros e abre o registro)
export function buildReminderPush(peak: DayPeak, date: string, appUrl: string) {
  const params = new URLSearchParams({ registrar: peak.beachId, dia: date, hora: String(peak.hour) })
  return {
    title: 'Caiu hoje?',
    body: `${peak.beachName} tava ${peak.score.toFixed(1)} às ${peak.hour}h. Toca pra registrar a sessão, leva 10 segundos.`,
    url: `${appUrl}/surf-log?${params}`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  }
}

export interface ReminderUserState {
  hasSessionToday: boolean
  // user_preferences: desligou o lembrete nas Configurações, tocou "Não caí" no cartão da Home
  // hoje, ou já recebeu o aviso hoje (o robô rodando 2x não manda de novo)
  enabled: boolean
  dismissedOn: string | null
  sentOn: string | null
}

// Motivo pra não mandar (ou null se pode mandar)
export function skipReason(state: ReminderUserState, today: string): string | null {
  if (!state.enabled) return 'desligado'
  if (state.hasSessionToday) return 'já registrou'
  if (state.dismissedOn === today) return 'não caiu'
  if (state.sentOn === today) return 'já avisado'
  return null
}
