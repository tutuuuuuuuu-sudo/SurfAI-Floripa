export const config = { runtime: 'edge' }

import { verifyMpSignature } from './_mpAuth.js'
import { createPersistentRateLimiter } from './_httpUtils.js'
import { fetchMpPayment, activatePremiumFromPayment } from './_mpPayment.js'

// Por IP (não há userId disponível antes de buscar o pagamento no MP) — achado na
// auditoria de 22/ago/2026: este endpoint público não tinha nenhum limite, ao
// contrário do que um comentário em create-payment.ts dava a entender. Limite
// generoso porque o próprio Mercado Pago reenvia notificações do mesmo IP.
// Persistido no Postgres — webhook de pagamento, precisa valer mesmo com várias
// instâncias serverless rodando em paralelo.
const checkWebhookRateLimit = createPersistentRateLimiter('mp-webhook', 60)

function ok() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

export default async function handler(req: Request) {
  // MP envia GET, HEAD ou OPTIONS para validar o endpoint
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return ok()
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!(await checkWebhookRateLimit(ip))) {
    return new Response('Too Many Requests', { status: 429, headers: { 'Retry-After': '60' } })
  }

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
  const dataId = new URL(req.url).searchParams.get('data.id')
  const xSignature = req.headers.get('x-signature')
  const xRequestId = req.headers.get('x-request-id')

  if (parsedBody.live_mode === true) {
    if (!webhookSecret) {
      console.error('[mp-webhook] MP_WEBHOOK_SECRET não configurado — rejeitando live_mode')
      return new Response('Unauthorized', { status: 401 })
    }
    const valid = await verifyMpSignature(xSignature, xRequestId, dataId, webhookSecret)
    if (!valid) {
      console.error('[mp-webhook] Assinatura inválida — request rejeitado')
      return new Response('Unauthorized', { status: 401 })
    }
  } else if (webhookSecret) {
    // live_mode === false COM secret configurado: deve ser teste do painel MP.
    // Verificamos a assinatura; se não tiver (testes do painel não enviam), aceitamos
    // mas NÃO processamos pagamentos reais (guard abaixo por live_mode + id < 1M).
    if (xSignature) {
      const valid = await verifyMpSignature(xSignature, xRequestId, dataId, webhookSecret)
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
  const payment = await fetchMpPayment(body.data.id, accessToken)
  if (!payment) {
    console.error('[mp-webhook] Erro ao buscar pagamento:', body.data.id)
    return new Response('MP fetch error', { status: 500 })
  }

  console.log('[mp-webhook] Payment status:', payment.status, 'userId:', payment.external_reference)

  if (payment.status !== 'approved') return ok()

  const result = await activatePremiumFromPayment(payment, supabaseUrl, serviceKey)

  if (!result.ok) {
    if (result.reason === 'missing-userid') {
      console.error('[mp-webhook] userId não encontrado no pagamento')
      return new Response('Missing userId', { status: 400 })
    }
    console.error('[mp-webhook] Erro activate_premium:', result.detail)
    return new Response('DB error', { status: 500 })
  }

  console.log(result.activated ? '[mp-webhook] ✅ Premium ativado para userId:' : '[mp-webhook] Pagamento já processado, ignorando. userId:', result.userId)
  return ok()
}
