// Regras dos avisos por notificação no celular, fonte única do alerta de hora em hora
// (push-notify.ts) e do "Caiu hoje?" das 19h (session-reminder.ts), pros dois não divergirem.
// Prefixo _ = não exposto como endpoint HTTP pelo Vercel.

// Critério que cada aparelho salvou no painel de Alertas (tabela push_subscriptions)
export interface PushCriteria {
  min_score: number
  favorite_only: boolean
  beach_thresholds: Record<string, number> | null
}

// A praia bateu o alerta desse aparelho? Nota da praia (se a pessoa definiu uma) ou a nota geral,
// e só favoritas quando "só favoritas" está ligado.
export function beachMatches(sub: PushCriteria, beachId: string, score: number, favorites: string[]): boolean {
  const threshold = sub.beach_thresholds?.[beachId] ?? sub.min_score
  if (score < threshold) return false
  if (sub.favorite_only && !favorites.includes(beachId)) return false
  return true
}

// Alerta por notificação é benefício Premium (tabela de planos no CLAUDE.md): só quem tem Premium
// válido ou está na tabela admins recebe, mesmo que o aparelho continue inscrito depois de o plano
// acabar.
export async function premiumOrAdminIds(supabaseUrl: string, serviceKey: string, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set()
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  const [subsRes, adminsRes] = await Promise.all([
    fetch(
      `${supabaseUrl}/rest/v1/subscriptions?user_id=in.(${userIds.join(',')})&status=eq.premium&expires_at=gte.${new Date().toISOString()}&select=user_id`,
      { headers }
    ),
    fetch(`${supabaseUrl}/rest/v1/admins?user_id=in.(${userIds.join(',')})&select=user_id`, { headers }),
  ])
  const premiumRows = subsRes.ok ? await subsRes.json() as { user_id: string }[] : []
  const adminRows = adminsRes.ok ? await adminsRes.json() as { user_id: string }[] : []
  return new Set([...premiumRows, ...adminRows].map(r => r.user_id))
}

// Favoritas de cada usuário, numa consulta só. A coluna é beach_id: de 17/jun a 14/out/2026 o
// robô pedia "spot_id", o banco recusava, a lista voltava vazia sem aviso e, com "só favoritas"
// ligado (o padrão), nenhum alerta de mar bom chegou a sair.
export async function favoritesByUser(supabaseUrl: string, serviceKey: string, userIds: string[]): Promise<Record<string, string[]>> {
  if (userIds.length === 0) return {}
  const res = await fetch(
    `${supabaseUrl}/rest/v1/favorites?user_id=in.(${userIds.join(',')})&select=user_id,beach_id`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  )
  if (!res.ok) {
    console.error('[pushMatch] favoritas voltaram', res.status, (await res.text()).slice(0, 200))
    return {}
  }
  const rows = await res.json() as { user_id: string; beach_id: string }[]
  const byUser: Record<string, string[]> = {}
  for (const r of rows) (byUser[r.user_id] ??= []).push(r.beach_id)
  return byUser
}

// Alerta de mar bom (push-notify.ts, de hora em hora) só de dia: de madrugada a nota pode bater o
// alerta, mas acordar alguém às 3h pra dizer que o mar está bom não ajuda ninguém.
export const ALERT_FROM_HOUR = 5
export const ALERT_TO_HOUR = 18
export const isAlertHour = (hour: number) => hour >= ALERT_FROM_HOUR && hour <= ALERT_TO_HOUR

// Um aviso por praia por dia em cada aparelho (push_subscriptions.alerted_on/alerted_beaches): o
// robô roda de hora em hora e, sem isso, mandaria "Campeche está ótima" a cada hora de mar bom.
// Devolve a melhor praia que ainda não foi avisada hoje (goodBeachIds já vem da melhor pra pior).
export function nextAlertBeach(
  goodBeachIds: string[],
  sub: { alerted_on?: string | null; alerted_beaches?: string[] | null },
  today: string,
): string | null {
  const already = sub.alerted_on === today ? (sub.alerted_beaches ?? []) : []
  return goodBeachIds.find(id => !already.includes(id)) ?? null
}

// Lista de praias já avisadas hoje, depois de avisar `beachId`
export function markAlerted(sub: { alerted_on?: string | null; alerted_beaches?: string[] | null }, beachId: string, today: string) {
  const already = sub.alerted_on === today ? (sub.alerted_beaches ?? []) : []
  return { alerted_on: today, alerted_beaches: [...already, beachId] }
}
