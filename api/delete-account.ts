export const config = { runtime: 'edge' }

import { verifyToken } from './_auth.js'

const ALLOWED_ORIGIN = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'DELETE') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim()
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const { valid, userId } = await verifyToken(token)
  if (!valid || !userId) return json({ error: 'Unauthorized' }, 401)

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return json({ error: 'Configuração incompleta' }, 500)

  const headers = { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }

  // Remove dados do usuário em todas as tabelas
  await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/favorites?user_id=eq.${userId}`, { method: 'DELETE', headers }),
    fetch(`${supabaseUrl}/rest/v1/surf_sessions?user_id=eq.${userId}`, { method: 'DELETE', headers }),
    fetch(`${supabaseUrl}/rest/v1/comments?user_id=eq.${userId}`, { method: 'DELETE', headers }),
    fetch(`${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}`, { method: 'DELETE', headers }),
    fetch(`${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${userId}`, { method: 'DELETE', headers }),
    fetch(`${supabaseUrl}/rest/v1/user_preferences?user_id=eq.${userId}`, { method: 'DELETE', headers }),
    fetch(`${supabaseUrl}/rest/v1/score_snapshots?user_id=eq.${userId}`, { method: 'DELETE', headers }),
  ])

  // Remove a conta de autenticação
  const deleteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers,
  })

  if (!deleteRes.ok) {
    return json({ error: 'Erro ao excluir conta' }, 500)
  }

  return json({ ok: true })
}
