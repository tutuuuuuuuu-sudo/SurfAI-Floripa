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

  // Todas as FKs de tabelas de usuário pra auth.users já têm ON DELETE CASCADE
  // (confirmado via pg_constraint) — apagar a conta abaixo já limpa favorites,
  // surf_sessions, comments, subscriptions, push_subscriptions, user_preferences,
  // payments, profiles, surf_log, admins e spot_validations sozinho. Os deletes
  // manuais que existiam aqui antes eram redundantes; o de score_snapshots era
  // pior — essa tabela não tem coluna user_id, então a chamada sempre falhava
  // silenciosamente (o Promise.all não checava .ok) sem fazer nada.

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
