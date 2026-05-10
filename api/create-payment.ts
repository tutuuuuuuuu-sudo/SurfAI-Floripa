export const config = { runtime: 'edge' }

const ALLOWED_ORIGIN = process.env.VITE_APP_URL ?? 'https://surf-ai-floripa.vercel.app'

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) return json({ error: 'MP_ACCESS_TOKEN não configurado no Vercel' }, 500)

  let userId: string, userEmail: string
  try {
    const body = await req.json() as { userId: string; userEmail: string }
    userId = body.userId
    userEmail = body.userEmail
  } catch {
    return json({ error: 'Body inválido' }, 400)
  }

  if (!userId || !userEmail) return json({ error: 'userId e userEmail são obrigatórios' }, 400)

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(userEmail)) return json({ error: 'Email inválido' }, 400)
  if (userId.length > 128) return json({ error: 'userId inválido' }, 400)

  const baseUrl = process.env.VITE_APP_URL ?? 'https://surf-ai-floripa.vercel.app'

  const preference = {
    items: [{
      id: 'surf-ai-premium-mensal',
      title: 'Surf AI Premium — Mensal',
      description: 'Acesso completo ao Surf AI Floripa por 30 dias',
      quantity: 1,
      currency_id: 'BRL',
      unit_price: 29.90,
    }],
    payer: { email: userEmail },
    external_reference: userId,
    back_urls: {
      success: `${baseUrl}/premium?status=success`,
      failure: `${baseUrl}/premium?status=failure`,
      pending: `${baseUrl}/premium?status=pending`,
    },
    auto_return: 'approved',
    notification_url: `${baseUrl}/api/mp-webhook`,
    statement_descriptor: 'SURF AI FLORIPA',
    expires: false,
  }

  const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(preference),
  })

  if (!mpRes.ok) {
    const err = await mpRes.text()
    console.error('[create-payment] MP error:', err)
    return json({ error: 'Erro ao criar preferência no Mercado Pago' }, 500)
  }

  const data = await mpRes.json() as { id: string; init_point: string; sandbox_init_point: string }
  return json({ id: data.id, init_point: data.init_point, sandbox_init_point: data.sandbox_init_point })
}
