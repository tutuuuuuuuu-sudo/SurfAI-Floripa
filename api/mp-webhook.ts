export const config = { runtime: 'edge' }

function ok() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

// Verifica a assinatura HMAC enviada pelo Mercado Pago no header x-signature.
// Documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
async function verifyMpSignature(req: Request, secret: string): Promise<boolean> {
  const xSignature = req.headers.get('x-signature')
  const xRequestId = req.headers.get('x-request-id')
  const url = new URL(req.url)
  const dataId = url.searchParams.get('data.id')

  if (!xSignature) return false

  const parts = Object.fromEntries(xSignature.split(',').map(p => p.trim().split('=')))
  const ts = parts['ts']
  const hash = parts['v1']
  if (!ts || !hash) return false

  const manifest = `id:${dataId ?? ''};request-id:${xRequestId ?? ''};ts:${ts};`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest))
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')

  return computed === hash
}

export default async function handler(req: Request) {
  // MP envia GET para validar o endpoint
  if (req.method === 'GET') return ok()
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const accessToken = process.env.MP_ACCESS_TOKEN
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  const webhookSecret = process.env.MP_WEBHOOK_SECRET

  if (!accessToken || !supabaseUrl || !serviceKey || !webhookSecret) {
    console.error('[mp-webhook] Variáveis de ambiente faltando')
    return new Response('Config error', { status: 500 })
  }

  const valid = await verifyMpSignature(req, webhookSecret)
  if (!valid) {
    console.error('[mp-webhook] Assinatura inválida — request rejeitado')
    return new Response('Unauthorized', { status: 401 })
  }

  let body: { type: string; data?: { id: string } }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid body', { status: 400 })
  }

  console.log('[mp-webhook] Notificação:', body.type, body.data?.id)

  if (body.type !== 'payment' || !body.data?.id) return ok()

  // Busca detalhes do pagamento no MP
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${body.data.id}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })

  if (!mpRes.ok) {
    console.error('[mp-webhook] Erro ao buscar pagamento:', body.data.id)
    return new Response('MP fetch error', { status: 500 })
  }

  const payment = await mpRes.json() as {
    id: number; status: string; external_reference: string;
    preference_id: string; transaction_amount: number; payment_type_id: string
  }

  console.log('[mp-webhook] Payment status:', payment.status, 'userId:', payment.external_reference)

  if (payment.status !== 'approved') return ok()

  const userId = payment.external_reference
  if (!userId) {
    console.error('[mp-webhook] userId não encontrado no pagamento')
    return new Response('Missing userId', { status: 400 })
  }

  // Chama a função activate_premium via Supabase REST
  const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/activate_premium`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      p_user_id: userId,
      p_mp_payment_id: String(payment.id),
      p_mp_preference_id: payment.preference_id ?? '',
      p_amount: payment.transaction_amount,
      p_payment_method: payment.payment_type_id ?? 'unknown',
    }),
  })

  if (!rpcRes.ok) {
    const err = await rpcRes.text()
    console.error('[mp-webhook] Erro activate_premium:', err)
    return new Response('DB error', { status: 500 })
  }

  console.log('[mp-webhook] ✅ Premium ativado para userId:', userId)
  return ok()
}
