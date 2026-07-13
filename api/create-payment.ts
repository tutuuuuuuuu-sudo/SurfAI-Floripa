export const config = { runtime: 'edge' }
import { createClient } from '@supabase/supabase-js'

const ALLOWED_ORIGIN = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

  // Valida JWT do usuário — impede que alguém crie pagamento com userId de outra pessoa
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
  const token = authHeader.slice(7)

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) return json({ error: 'Configuração de servidor incompleta' }, 500)

  const supabase = createClient(supabaseUrl, serviceKey)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  let userEmail: string
  let plan: 'monthly' | 'annual' = 'monthly'
  try {
    const body = await req.json() as { userEmail?: string; plan?: string }
    userEmail = body.userEmail ?? user.email ?? ''
    if (body.plan === 'annual') plan = 'annual'
  } catch {
    userEmail = user.email ?? ''
  }

  const userId = user.id

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(userEmail)) return json({ error: 'Email inválido' }, 400)

  const baseUrl = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'

  const isAnnual = plan === 'annual'
  const preference = {
    items: [{
      id: isAnnual ? 'surf-ai-premium-anual' : 'surf-ai-premium-mensal',
      title: isAnnual ? 'Surf AI Premium — Anual' : 'Surf AI Premium — Mensal',
      description: isAnnual
        ? 'Acesso completo ao Surf AI Floripa por 12 meses (equivale a R$ 12,49/mês)'
        : 'Acesso completo ao Surf AI Floripa por 30 dias',
      quantity: 1,
      currency_id: 'BRL',
      unit_price: isAnnual ? 149.90 : 16.90,
    }],
    payer: { email: userEmail },
    external_reference: `${userId}|${plan}`,
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
    return json({ error: 'Erro ao criar preferência de pagamento' }, 500)
  }

  const data = await mpRes.json() as { id: string; init_point: string; sandbox_init_point: string }
  const isSandbox = accessToken.startsWith('TEST-')
  const init_point = isSandbox ? data.sandbox_init_point : data.init_point
  return json({ id: data.id, init_point, sandbox_init_point: data.sandbox_init_point })
}
