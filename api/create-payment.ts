export const config = { runtime: 'edge' }
import { createClient } from '@supabase/supabase-js'
import { createPersistentRateLimiter } from './_httpUtils.js'
import { PRICE_MONTHLY, PRICE_ANNUAL, PRICE_ANNUAL_PER_MONTH, formatBRL } from '../src/lib/pricing.js'
import { createPreapproval, cancelPreapproval, friendlyCardError } from './_mpSubscription.js'
import { buildDirectPayment, createDirectPayment, friendlyPaymentError, type BrickFormData } from './_mpDirectPayment.js'
import { activatePremiumFromPayment } from './_mpPayment.js'

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
  // cardToken: código de uso único do cartão, gerado pelo formulário do MP dentro do app
  let cardToken = ''
  // payment: dados do formulário completo do MP (anual / 1 mês avulso dentro do app, _mpDirectPayment.ts)
  let directForm: BrickFormData | null = null
  let idempotencyKey = ''
  let deviceId = ''
  try {
    const body = await req.json() as {
      userEmail?: string; plan?: string; autoRenew?: boolean; payerEmail?: string; cardToken?: string
      payment?: BrickFormData; idempotencyKey?: string; deviceId?: string
    }
    userEmail = body.userEmail ?? user.email ?? ''
    if (body.plan === 'annual') plan = 'annual'
    autoRenew = plan === 'monthly' && body.autoRenew === true
    payerEmail = (body.payerEmail ?? '').trim().toLowerCase()
    cardToken = typeof body.cardToken === 'string' ? body.cardToken.trim() : ''
    if (body.payment && typeof body.payment === 'object') directForm = body.payment
    idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.replace(/[^\w-]/g, '').slice(0, 64) : ''
    deviceId = typeof body.deviceId === 'string' ? body.deviceId.slice(0, 200) : ''
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

  // Anual ou 1 mês avulso pagos dentro do app (formulário completo do MP: cartão, Pix ou boleto)
  if (!autoRenew && directForm) {
    const built = buildDirectPayment({ plan, userId, userEmail, form: directForm, baseUrl })
    if (!built.ok) return json({ error: built.error }, 400)
    const created = await createDirectPayment(built.body, {
      accessToken,
      // Mesmo envio repetido (rede caiu e o navegador mandou de novo) não cobra duas vezes
      idempotencyKey: `${userId}-${idempotencyKey || crypto.randomUUID()}`,
      deviceId: deviceId || undefined,
    })
    if (!created.ok) {
      console.error('[create-payment] MP payment error:', created.status, created.detail)
      return json({ error: friendlyPaymentError(created.detail) }, 402)
    }
    const payment = created.payment
    console.log('[create-payment] pagamento direto:', payment.id, payment.status, payment.status_detail, plan)
    if (payment.status === 'rejected' || payment.status === 'cancelled') {
      return json({ error: friendlyPaymentError(payment.status_detail ?? '') }, 402)
    }
    if (payment.status === 'approved') {
      // Cartão aprovado: libera o Premium agora, sem esperar o aviso do MP (o aviso, quando
      // chegar, não ativa de novo — activate_premium é idempotente pelo id do pagamento)
      const activation = await activatePremiumFromPayment({ ...payment, preference_id: payment.preference_id ?? '' }, supabaseUrl, serviceKey)
      if (!activation.ok) console.error('[create-payment] ativação imediata falhou, o webhook tenta de novo:', activation)
    }
    // pending (Pix/boleto esperando pagamento) ou in_process (cartão em análise): a tela de
    // status do MP mostra o QR code / boleto / análise, e o webhook ativa quando o pagamento cair
    return json({ ok: true, id: payment.id, status: payment.status })
  }

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
      cardTokenId: cardToken || undefined,
    })
    if (!pre.ok) {
      console.error('[create-payment] MP preapproval error:', pre.status, pre.detail)
      if (cardToken) return json({ error: friendlyCardError(pre.detail) }, 402)
      return json({ error: 'Não deu pra criar a assinatura no Mercado Pago. Confira o e-mail da sua conta do Mercado Pago e tente de novo.' }, 500)
    }

    if (cardToken) {
      // Assinatura já autorizada no cartão. Quem já tem linha (ex.: está no teste grátis) vê a
      // renovação ligada na hora; a 1ª cobrança (até ~1 h) ativa/estende o Premium pelo webhook
      if (pre.status !== 'authorized') {
        // MP criou mas não autorizou o cartão: cancela pra não ficar assinatura pendurada
        console.error('[create-payment] assinatura com cartão não autorizada:', pre.id, pre.status)
        await cancelPreapproval(pre.id, accessToken)
        return json({ error: 'O Mercado Pago não autorizou o cartão. Confira os dados ou tente outro cartão de crédito.' }, 402)
      }
      await supabase.from('subscriptions')
        .update({ mp_preapproval_id: pre.id, auto_renew: true })
        .eq('user_id', userId)
      return json({ ok: true, id: pre.id, status: pre.status })
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
