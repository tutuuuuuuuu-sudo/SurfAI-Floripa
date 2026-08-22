export const config = { runtime: 'edge' }

import { verifyMpSignature } from './_mpAuth.js'
import { fetchMpPayment, activatePremiumFromPayment } from './_mpPayment.js'

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
  if (!webhookSecret) {
    console.error('[mp-ipn] MP_WEBHOOK_SECRET não configurado — rejeitando request')
    return new Response('{"error":"Unauthorized"}', { status: 401, headers })
  }
  const valid = await verifyMpSignature(
    req.headers.get('x-signature'),
    req.headers.get('x-request-id'),
    url.searchParams.get('data.id') ?? id,
    webhookSecret,
  )
  if (!valid) {
    console.error('[mp-ipn] Assinatura HMAC inválida — request rejeitado')
    return new Response('{"error":"Unauthorized"}', { status: 401, headers })
  }

  if (topic !== 'payment') return new Response('{"ok":true}', { status: 200, headers })

  const accessToken = process.env.MP_ACCESS_TOKEN
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY

  if (!accessToken || !supabaseUrl || !serviceKey) {
    return new Response('{"ok":true}', { status: 200, headers })
  }

  try {
    const payment = await fetchMpPayment(id, accessToken)
    if (!payment) return new Response('{"ok":true}', { status: 200, headers })

    if (payment.status === 'approved' && payment.external_reference) {
      const result = await activatePremiumFromPayment(payment, supabaseUrl, serviceKey)
      if (!result.ok) {
        console.error('[mp-ipn] activate_premium falhou:', result.reason === 'rpc-error' ? result.detail : result.reason)
        return new Response('{"error":"activation failed"}', { status: 500, headers })
      }
      console.log(result.activated ? '[mp-ipn] ✅ Premium ativado:' : '[mp-ipn] Pagamento já processado, ignorando:', payment.id)
    }

    return new Response('{"ok":true}', { status: 200, headers })
  } catch (err) {
    console.error('[mp-ipn] Erro ao processar pagamento:', err)
    return new Response('{"error":"Internal error"}', { status: 500, headers })
  }
}
