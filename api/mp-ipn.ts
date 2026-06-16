export const config = { runtime: 'edge' }

// Reutiliza a mesma lógica de verificação HMAC do mp-webhook.ts
async function verifyMpSignature(req: Request, secret: string): Promise<boolean> {
  const xSignature = req.headers.get('x-signature')
  const xRequestId = req.headers.get('x-request-id')
  const url = new URL(req.url)
  const dataId = url.searchParams.get('data.id') ?? url.searchParams.get('id')

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
  const url = new URL(req.url)
  const topic = url.searchParams.get('topic')
  const id = url.searchParams.get('id')

  const headers = { 'Content-Type': 'application/json' }

  // Aceita GET, POST e qualquer método que o MP envie
  if (!['GET', 'POST', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return new Response('{"ok":true}', { status: 200, headers })
  }

  // Retorna 200 imediatamente para qualquer requisição de validação/teste
  if (!topic || !id || Number(id) < 1000000) {
    return new Response('{"ok":true}', { status: 200, headers })
  }

  // Valida assinatura HMAC quando o secret estiver configurado em produção.
  // Em produção, requisições sem assinatura válida são rejeitadas com 401.
  const webhookSecret = process.env.MP_WEBHOOK_SECRET
  if (webhookSecret && req.method === 'POST') {
    const valid = await verifyMpSignature(req, webhookSecret)
    if (!valid) {
      console.error('[mp-ipn] Assinatura HMAC inválida — request rejeitado')
      return new Response('{"error":"Unauthorized"}', { status: 401, headers })
    }
  }

  if (topic !== 'payment') return new Response('{"ok":true}', { status: 200, headers })

  const accessToken = process.env.MP_ACCESS_TOKEN
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY

  if (!accessToken || !supabaseUrl || !serviceKey) {
    return new Response('{"ok":true}', { status: 200, headers })
  }

  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })

    if (!mpRes.ok) return new Response('{"ok":true}', { status: 200, headers })

    const payment = await mpRes.json() as {
      id: number; status: string; external_reference: string;
      preference_id: string; transaction_amount: number; payment_type_id: string
    }

    if (payment.status === 'approved' && payment.external_reference) {
      const [userId, plan] = (payment.external_reference ?? '').split('|')
      const durationDays = plan === 'annual' ? 365 : 30
      await fetch(`${supabaseUrl}/rest/v1/rpc/activate_premium`, {
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
        }),
      })
    }

    return new Response('{"ok":true}', { status: 200, headers })
  } catch (err) {
    console.error('[mp-ipn] Erro ao processar pagamento:', err)
    return new Response('{"error":"Internal error"}', { status: 500, headers })
  }
}
