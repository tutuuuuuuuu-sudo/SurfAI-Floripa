export const config = { runtime: 'edge' }

function ok() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default async function handler(req: Request) {
  const url = new URL(req.url)
  const topic = url.searchParams.get('topic')
  const id = url.searchParams.get('id')

  // Teste do painel MP ou tópico irrelevante
  if (!topic || !id || Number(id) < 1000000) return ok()
  if (topic !== 'payment') return ok()

  const accessToken = process.env.MP_ACCESS_TOKEN
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!accessToken || !supabaseUrl || !serviceKey) {
    console.error('[mp-ipn] Variáveis de ambiente faltando')
    return new Response('Config error', { status: 500 })
  }

  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })

  if (!mpRes.ok) {
    console.error('[mp-ipn] Erro ao buscar pagamento:', id)
    return ok()
  }

  const payment = await mpRes.json() as {
    id: number; status: string; external_reference: string;
    preference_id: string; transaction_amount: number; payment_type_id: string
  }

  if (payment.status !== 'approved') return ok()

  const userId = payment.external_reference
  if (!userId) return ok()

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
    console.error('[mp-ipn] Erro activate_premium:', err)
  } else {
    console.log('[mp-ipn] ✅ Premium ativado para userId:', userId)
  }

  return ok()
}
