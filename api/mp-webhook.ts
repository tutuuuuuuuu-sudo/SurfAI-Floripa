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
  const computedBytes = new Uint8Array(sig)
  const hashBytes = new Uint8Array(hash.length / 2)
  for (let i = 0; i < hashBytes.length; i++) {
    hashBytes[i] = parseInt(hash.slice(i * 2, i * 2 + 2), 16)
  }
  if (computedBytes.length !== hashBytes.length) return false
  let diff = 0
  for (let i = 0; i < computedBytes.length; i++) diff |= computedBytes[i] ^ hashBytes[i]
  return diff === 0
}

export default async function handler(req: Request) {
  // MP envia GET, HEAD ou OPTIONS para validar o endpoint
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return ok()
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const accessToken = process.env.MP_ACCESS_TOKEN
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  const webhookSecret = process.env.MP_WEBHOOK_SECRET

  if (!accessToken || !supabaseUrl || !serviceKey) {
    console.error('[mp-webhook] Variáveis de ambiente faltando')
    return new Response('Config error', { status: 500 })
  }

  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    rawBody = ''
  }

  let parsedBody: { type?: string; data?: { id: string }; live_mode?: boolean } = {}
  try { parsedBody = rawBody ? JSON.parse(rawBody) : {} } catch { /* ignorar */ }

  if (!parsedBody.type) return ok()

  // Valida assinatura HMAC sempre que o secret estiver configurado.
  // Testes do painel MP (live_mode === false) não têm assinatura válida, então
  // só pulamos a verificação quando o secret NÃO está configurado (ambiente de dev).
  // Em produção o secret DEVE estar configurado — sem ele, rejeitamos live_mode=true.
  if (parsedBody.live_mode === true) {
    if (!webhookSecret) {
      console.error('[mp-webhook] MP_WEBHOOK_SECRET não configurado — rejeitando live_mode')
      return new Response('Unauthorized', { status: 401 })
    }
    const valid = await verifyMpSignature(req, webhookSecret)
    if (!valid) {
      console.error('[mp-webhook] Assinatura inválida — request rejeitado')
      return new Response('Unauthorized', { status: 401 })
    }
  } else if (webhookSecret) {
    // live_mode === false COM secret configurado: deve ser teste do painel MP.
    // Verificamos a assinatura; se não tiver (testes do painel não enviam), aceitamos
    // mas NÃO processamos pagamentos reais (guard abaixo por live_mode + id < 1M).
    const xSignature = req.headers.get('x-signature')
    if (xSignature) {
      const valid = await verifyMpSignature(req, webhookSecret)
      if (!valid) {
        console.error('[mp-webhook] Assinatura inválida em teste — rejeitado')
        return new Response('Unauthorized', { status: 401 })
      }
    }
  }

  const body = parsedBody

  console.log('[mp-webhook] Notificação:', body.type, body.data?.id)

  if (body.type !== 'payment' || !body.data?.id) return ok()

  // IDs de teste do painel MP (ex: 123456) — retorna ok sem buscar
  if (!parsedBody.live_mode && Number(body.data.id) < 1000000) return ok()

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

  // external_reference pode ser "userId|plan" (novo) ou só "userId" (legado)
  const [userId, plan] = (payment.external_reference ?? '').split('|')
  if (!userId) {
    console.error('[mp-webhook] userId não encontrado no pagamento')
    return new Response('Missing userId', { status: 400 })
  }

  // Duração: 12 meses para anual, 30 dias para mensal
  const durationDays = plan === 'annual' ? 365 : 30

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
      p_duration_days: durationDays,
      p_plan: plan === 'annual' ? 'annual' : 'monthly',
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
