// Utilitários de autenticação compartilhados entre serverless functions.
// Prefixo _ = não exposto como endpoint HTTP pelo Vercel.

export interface AuthResult {
  valid: boolean
  userId: string | null
  // Mesma lógica de src/lib/supabase.ts (getUserDisplayName), duplicada aqui de propósito:
  // essa função roda no edge (Vercel), não pode importar aquele módulo (ele instancia um
  // client supabase-js com import.meta.env, que só existe no build do Vite).
  displayName: string | null
}

export async function verifyToken(token: string): Promise<AuthResult> {
  const supabaseUrl = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !anonKey) return { valid: false, userId: null, displayName: null }
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    })
    if (!res.ok) return { valid: false, userId: null, displayName: null }
    const user = await res.json() as { id?: string; email?: string; user_metadata?: Record<string, unknown> }
    const meta = user.user_metadata ?? {}
    const displayName = (meta.full_name as string | undefined)
      ?? (meta.name as string | undefined)
      ?? user.email?.split('@')[0]
      ?? null
    return { valid: true, userId: user.id ?? null, displayName }
  } catch {
    return { valid: false, userId: null, displayName: null }
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

export async function isAdminUser(userId: string): Promise<boolean> {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return false
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/admins?user_id=eq.${userId}&select=user_id&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    )
    if (!res.ok) return false
    const rows = await res.json() as { user_id: string }[]
    return Array.isArray(rows) && rows.length > 0
  } catch {
    return false
  }
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  const { valid, userId } = await verifyToken(token)
  if (!valid || !userId) return false
  return isAdminUser(userId)
}

// Chamada do agendador do Supabase (pg_cron + pg_net, 30/set/2026 — o agendamento do GitHub
// atrasava até 6 h). A senha fica no cofre do Supabase (vault, nome 'cron_secret'), vem no
// cabeçalho x-cron-secret e quem confere é a função check_cron_secret do banco, que só a chave
// de serviço pode chamar — assim a senha não precisa existir também nas variáveis da Vercel.
// As senhas antigas de cada robô continuam valendo (execução manual pelo GitHub).
//
// Uma segunda tentativa quando a conferência em si falha (erro de rede, demora, resposta não-200):
// na semana até 07/out/2026, 9 de ~470 chamadas do agendador voltaram 401 sem motivo aparente,
// e o catch antigo engolia o erro. Agora o motivo vai pro log da Vercel. Senha conferida e
// errada não repete.
export async function isSchedulerCall(req: Request): Promise<boolean> {
  const provided = req.headers.get('x-cron-secret')
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return false
  if (!provided || provided.length < 20) {
    // Separa "chegou sem a senha" de "a conferência falhou" no log
    console.error(`[isSchedulerCall] chamada sem a senha do agendador (${provided === null ? 'cabeçalho ausente' : `${provided.length} caracteres`})`)
    return false
  }
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/check_cron_secret`, {
        method: 'POST',
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_secret: provided }),
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) return (await res.json()) === true
      console.error(`[isSchedulerCall] conferência da senha voltou ${res.status} (tentativa ${attempt}):`, (await res.text()).slice(0, 200))
    } catch (err) {
      console.error(`[isSchedulerCall] conferência da senha falhou (tentativa ${attempt}):`, err instanceof Error ? `${err.name}: ${err.message}` : err)
    }
  }
  return false
}
