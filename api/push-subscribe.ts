export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const ALLOWED_ORIGIN = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

async function getUserId(token: string): Promise<string | null> {
  const anonKey = process.env.SUPABASE_ANON_KEY ?? SUPABASE_KEY
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    })
    if (!res.ok) return null
    const user = await res.json() as { id?: string }
    return user.id ?? null
  } catch { return null }
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim()
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const userId = await getUserId(token)
  if (!userId) return json({ error: 'Unauthorized' }, 401)

  // DELETE — remove subscription (usuário desativou notificações)
  if (req.method === 'DELETE') {
    await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${userId}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    })
    return json({ ok: true })
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  interface SubscribeBody {
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
    minScore?: number
    favoriteOnly?: boolean
  }

  let body: SubscribeBody
  try {
    body = await req.json() as SubscribeBody
  } catch {
    return json({ error: 'body inválido' }, 400)
  }
  if (!body.subscription?.endpoint || !body.subscription?.keys?.p256dh || !body.subscription?.keys?.auth) {
    return json({ error: 'subscription inválida' }, 400)
  }

  // Upsert: um usuário pode ter múltiplos dispositivos — usa endpoint como chave
  const row = {
    user_id: userId,
    endpoint: body.subscription.endpoint,
    p256dh: body.subscription.keys.p256dh,
    auth: body.subscription.keys.auth,
    min_score: body.minScore ?? 7,
    favorite_only: body.favoriteOnly ?? true,
    updated_at: new Date().toISOString(),
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  })

  if (!res.ok) {
    const err = await res.text()
    return json({ error: err }, 500)
  }

  return json({ ok: true })
}
