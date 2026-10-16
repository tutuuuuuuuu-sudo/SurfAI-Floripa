export const config = { runtime: 'edge' }

// Cancelar a renovação automática do plano mensal (botão em Configurações). Cancela a assinatura
// no Mercado Pago e desliga auto_renew; o Premium continua até expires_at (já pago) e os lembretes
// de fim de plano voltam a valer pra essa pessoa.

import { verifyToken } from './_auth.js'
import { cancelPreapproval } from './_mpSubscription.js'
import { createPersistentRateLimiter } from './_httpUtils.js'

const checkRateLimit = createPersistentRateLimiter('cancel-renewal', 5)

const ALLOWED_ORIGIN = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } })
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
  const auth = await verifyToken(authHeader.slice(7))
  if (!auth.valid || !auth.userId) return json({ error: 'Unauthorized' }, 401)

  const accessToken = process.env.MP_ACCESS_TOKEN
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!accessToken || !supabaseUrl || !serviceKey) return json({ error: 'Configuração de servidor incompleta' }, 500)

  if (!(await checkRateLimit(auth.userId))) return json({ error: 'Muitas tentativas, aguarde um minuto.' }, 429)

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
  const subRes = await fetch(
    `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${auth.userId}&select=mp_preapproval_id,auto_renew,expires_at`,
    { headers },
  )
  const rows = subRes.ok ? await subRes.json() as { mp_preapproval_id: string | null; auto_renew: boolean; expires_at: string | null }[] : []
  const sub = rows[0]
  if (!sub?.auto_renew || !sub.mp_preapproval_id) return json({ error: 'Sua renovação automática não está ligada.' }, 400)

  if (!(await cancelPreapproval(sub.mp_preapproval_id, accessToken))) {
    console.error('[cancel-renewal] MP recusou o cancelamento', sub.mp_preapproval_id)
    return json({ error: 'O Mercado Pago não confirmou o cancelamento. Tente de novo em instantes.' }, 502)
  }

  await fetch(`${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${auth.userId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ auto_renew: false }),
  })
  return json({ ok: true, expires_at: sub.expires_at })
}
