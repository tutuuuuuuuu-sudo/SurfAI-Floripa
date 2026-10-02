export const config = { runtime: 'edge' }
import { createClient } from '@supabase/supabase-js'
import { createPersistentRateLimiter } from './_httpUtils.js'
import { PRICE_MONTHLY, PRICE_ANNUAL, PRICE_ANNUAL_PER_MONTH, formatBRL } from '../src/lib/pricing.js'
import { createPreapproval } from './_mpSubscription.js'

// Por userId (não IP) porque o endpoint já exige token válido — um bug de retry
// no frontend ou usuário malicioso conseguia gerar preferências reais no Mercado
// Pago sem limite antes desta correção. Persistido no Postgres (não Map em memória)
// porque é um endpoint que mexe com dinheiro — precisa valer mesmo com várias
// instâncias serverless rodando em paralelo.
const checkPaymentRateLimit = createPersistentRateLimiter('create-payment', 5)

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
  // Mensal com renovação automática (assinatura do MP, só cartão). payerEmail = e-mail da conta
  // do Mercado Pago de quem paga, que pode ser diferente do e-mail do app (ver _mpSubscription.ts)
  let autoRenew = false
  let payerEmail = ''
  try {
    const body = await req.json() as { userEmail?: string; plan?: string; autoRenew?: boolean; payerEmail?: string }
    userEmail = body.userEmail ?? user.email ?? ''
    if (body.plan === 'annual') plan = 'annual'
    autoRenew = plan === 'monthly' && body.autoRenew === true
    payerEmail = (body.payerEmail ?? '').trim().toLowerCase()
  } catch {
    userEmail = user.email ?? ''
  }

  const userId = user.id

  if (!(await checkPaymentRateLimit(userId))) {
    return json({ error: 'Muitas tentativas, aguarde um minuto e tente de novo' }, 429)
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(userEmail)) return json({ error: 'Email inválido' }, 400)

  const baseUrl = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'

  if (autoRenew) {
    const mpEmail = payerEmail || userEmail
    if (!emailRegex.test(mpEmail)) return json({ error: 'E-mail do Mercado Pago inválido' }, 400)

    // Já tem renovação ligada: não deixa criar uma segunda assinatura (cobraria duas vezes)
    const { data: current } = await supabase
      .from('subscriptions').select('auto_renew').eq('user_id', userId).maybeSingle()
    if (current?.auto_renew) return json({ error: 'Sua renovação automática já está ligada.' }, 409)

    const pre = await createPreapproval({
      accessToken,
      userId,
      payerEmail: mpEmail,
      backUrl: `${baseUrl}/premium?status=assinatura`,
    })
    if (!pre.ok) {
      console.error('[create-payment] MP preapproval error:', pre.status, pre.detail)
      return json({ error: 'Não deu pra criar a assinatura no Mercado Pago. Confira o e-mail da sua conta do Mercado Pago e tente de novo.' }, 500)
    }
    return json({ id: pre.id, init_point: pre.initPoint })
  }

  const isAnnual = plan === 'annual'
  const preference = {
    items: [{
      id: isAnnual ? 'surf-ai-premium-anual' : 'surf-ai-premium-mensal',
      title: isAnnual ? 'Surf AI Premium Anual' : 'Surf AI Premium Mensal',
      description: isAnnual
        ? `Acesso completo ao Surf AI Floripa por 12 meses (equivale a ${formatBRL(PRICE_ANNUAL_PER_MONTH)}/mês)`
        : 'Acesso completo ao Surf AI Floripa por 30 dias',
      quantity: 1,
      currency_id: 'BRL',
      unit_price: isAnnual ? PRICE_ANNUAL : PRICE_MONTHLY,
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
    signal: AbortSignal.timeout(10000),
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
