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

// Favoritas de cada usuário, numa consulta só
export async function favoritesByUser(supabaseUrl: string, serviceKey: string, userIds: string[]): Promise<Record<string, string[]>> {
  if (userIds.length === 0) return {}
  const res = await fetch(
    `${supabaseUrl}/rest/v1/favorites?user_id=in.(${userIds.join(',')})&select=user_id,spot_id`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  )
  const rows = res.ok ? await res.json() as { user_id: string; spot_id: string }[] : []
  const byUser: Record<string, string[]> = {}
  for (const r of rows) (byUser[r.user_id] ??= []).push(r.spot_id)
  return byUser
}
