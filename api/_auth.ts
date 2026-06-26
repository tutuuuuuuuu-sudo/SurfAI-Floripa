// Utilitários de autenticação compartilhados entre serverless functions.
// Prefixo _ = não exposto como endpoint HTTP pelo Vercel.

export interface AuthResult {
  valid: boolean
  userId: string | null
}

export async function verifyToken(token: string): Promise<AuthResult> {
  const supabaseUrl = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !anonKey) return { valid: false, userId: null }
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    })
    if (!res.ok) return { valid: false, userId: null }
    const user = await res.json() as { id?: string }
    return { valid: true, userId: user.id ?? null }
  } catch {
    return { valid: false, userId: null }
  }
}

export async function isPremiumUser(userId: string): Promise<boolean> {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return false
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  try {
    // Admins têm acesso premium permanente
    const adminRes = await fetch(
      `${supabaseUrl}/rest/v1/admins?user_id=eq.${userId}&select=user_id&limit=1`,
      { headers }
    )
    if (adminRes.ok) {
      const admins = await adminRes.json() as { user_id: string }[]
      if (Array.isArray(admins) && admins.length > 0) return true
    }
  } catch { /* ignora e verifica assinatura normal */ }
  try {
    const now = new Date().toISOString()
    const res = await fetch(
      `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}&status=eq.premium&expires_at=gte.${now}&select=id&limit=1`,
      { headers }
    )
    if (!res.ok) return false
    const rows = await res.json() as { id: string }[]
    return Array.isArray(rows) && rows.length > 0
  } catch {
    return false
  }
}

export async function verifyPremiumToken(token: string): Promise<boolean> {
  const { valid, userId } = await verifyToken(token)
  if (!valid || !userId) return false
  return isPremiumUser(userId)
}
