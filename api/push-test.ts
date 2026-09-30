export const config = { runtime: 'edge' }

// Alerta de teste pedido pelo próprio usuário no painel de Alertas (30/set/2026): manda um push de
// verdade, pelo mesmo caminho dos alertas de hora em hora (push-notify.ts), só pros aparelhos DELE
// (push_subscriptions). Serve pra confirmar que o alerta chega — principalmente no iPhone, que só
// recebe com o app instalado na tela de início (iOS 16.4+). O botão antigo só mostrava algo se
// alguma praia já estivesse acima da nota mínima, e nunca passava pelo servidor.

import { verifyToken } from './_auth.js'
import { sendPush, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } from './_webPush.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? ''

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

// Freio simples por instância: um teste a cada 20 s por usuário (só vai pros aparelhos dele mesmo)
const lastTest = new Map<string, number>()

export default async function handler(req: Request) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!SUPABASE_URL || !SUPABASE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: 'Configuração incompleta' }, 500)
  }

  const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim()
  const auth = token ? await verifyToken(token) : null
  if (!auth?.valid || !auth.userId) return json({ error: 'Unauthorized' }, 401)
  const userId = auth.userId

  const now = Date.now()
  if (now - (lastTest.get(userId) ?? 0) < 20000) return json({ error: 'Aguarde alguns segundos' }, 429)
  lastTest.set(userId, now)

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${userId}&select=endpoint,p256dh,auth`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  )
  if (!res.ok) return json({ error: 'Erro ao buscar inscrições' }, 500)
  const subs = await res.json() as { endpoint: string; p256dh: string; auth: string }[]
  if (subs.length === 0) return json({ sent: 0, total: 0 })

  const payload = JSON.stringify({
    title: 'Surf AI · alerta de teste',
    body: 'Se você está vendo isso, os alertas de swell estão funcionando neste aparelho.',
    url: '/',
  })
  const results = await Promise.all(subs.map(s => sendPush(s.endpoint, s.p256dh, s.auth, payload)))
  return json({ sent: results.filter(Boolean).length, total: subs.length })
}
