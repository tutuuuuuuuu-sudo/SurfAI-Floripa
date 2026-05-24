export const config = { runtime: 'edge' }

export default async function handler(req: Request) {
  const url = new URL(req.url)
  const topic = url.searchParams.get('topic')
  const id = url.searchParams.get('id')

  // Retorna 200 imediatamente para qualquer requisição de validação/teste
  if (!topic || !id || Number(id) < 1000000) {
    return new Response('OK', { status: 200 })
  }

  if (topic !== 'payment') return new Response('OK', { status: 200 })

  const accessToken = process.env.MP_ACCESS_TOKEN
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!accessToken || !supabaseUrl || !serviceKey) {
    return new Response('OK', { status: 200 })
  }

  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })

    if (!mpRes.ok) return new Response('OK', { status: 200 })

    const payment = await mpRes.json() as {
      id: number; status: string; external_reference: string;
      preference_id: string; transaction_amount: number; payment_type_id: string
    }

    if (payment.status === 'approved' && payment.external_reference) {
      await fetch(`${supabaseUrl}/rest/v1/rpc/activate_premium`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          p_user_id: payment.external_reference,
          p_mp_payment_id: String(payment.id),
          p_mp_preference_id: payment.preference_id ?? '',
          p_amount: payment.transaction_amount,
          p_payment_method: payment.payment_type_id ?? 'unknown',
        }),
      })
    }
  } catch {
    // Sempre retorna 200 mesmo com erro
  }

  return new Response('OK', { status: 200 })
}
