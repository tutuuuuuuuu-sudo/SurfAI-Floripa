// Assinatura mensal com renovação automática (02/out/2026) — "assinatura sem plano associado" do
// Mercado Pago (/preapproval). Cobra no cartão todo mês até a pessoa cancelar; o MP cancela
// sozinho depois de 3 cobranças recusadas. Usado por create-payment.ts (criar), cancel-renewal.ts
// (cancelar) e mp-webhook.ts (avisos do MP). Prefixo _ indica que não é um handler HTTP.
//
// Pegadinhas do MP que moldaram isto:
// - O checkout da assinatura só deixa pagar quem entra no Mercado Pago com o MESMO e-mail de
//   payer_email. Por isso a página Premium pede "e-mail da sua conta do Mercado Pago".
// - /preapproval não aceita notification_url: os avisos (subscription_preapproval e
//   subscription_authorized_payment) vêm do webhook configurado no painel do MP.
// - A primeira cobrança sai em até ~1 hora depois de assinar, não na hora.

import { activatePremiumFromPayment, type ActivationResult } from './_mpPayment.js'
import { PRICE_MONTHLY } from '../src/lib/pricing.js'

const MP_API = 'https://api.mercadopago.com'

// external_reference da assinatura: "<userId>|monthly-auto" — o mesmo formato "<userId>|<plano>"
// dos pagamentos avulsos, então activatePremiumFromPayment entende os dois
export const AUTO_PLAN = 'monthly-auto'

export interface MpPreapproval {
  id: string
  status: string                // pending | authorized | paused | cancelled
  external_reference?: string
  payer_email?: string
  next_payment_date?: string
}

export interface MpAuthorizedPayment {
  id: number | string
  preapproval_id: string
  status: string                // scheduled | processed | recycling | cancelled ...
  transaction_amount?: number
  payment?: { id?: number | string; status?: string; status_detail?: string }
}

function mpHeaders(accessToken: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }
}

// Dois jeitos de criar a assinatura:
// - com cardTokenId (formulário de cartão do MP dentro do app): já nasce 'authorized', cobra no
//   cartão sem a pessoa sair do app e SEM precisar de conta no Mercado Pago
// - sem cardTokenId: nasce 'pending' e devolve init_point, a página de assinatura do MP — que exige
//   login numa conta do Mercado Pago com o mesmo e-mail de payer_email
export async function createPreapproval(params: {
  accessToken: string
  userId: string
  payerEmail: string
  backUrl: string
  cardTokenId?: string
}): Promise<{ ok: true; id: string; status: string; initPoint: string | null } | { ok: false; status: number; detail: string }> {
  const res = await fetch(`${MP_API}/preapproval`, {
    method: 'POST',
    headers: mpHeaders(params.accessToken),
    body: JSON.stringify({
      reason: 'Surf AI Premium Mensal',
      external_reference: `${params.userId}|${AUTO_PLAN}`,
      payer_email: params.payerEmail,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: PRICE_MONTHLY,
        currency_id: 'BRL',
      },
      back_url: params.backUrl,
      ...(params.cardTokenId ? { card_token_id: params.cardTokenId, status: 'authorized' } : { status: 'pending' }),
    }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) return { ok: false, status: res.status, detail: (await res.text()).slice(0, 500) }
  const data = await res.json() as { id: string; status: string; init_point?: string; sandbox_init_point?: string }
  // Mesma regra do pagamento avulso: chave de teste (TEST-) usa o checkout de teste
  const initPoint = (params.accessToken.startsWith('TEST-') && data.sandbox_init_point ? data.sandbox_init_point : data.init_point) ?? null
  return { ok: true, id: data.id, status: data.status, initPoint }
}

/** Texto pra pessoa quando o MP recusa criar a assinatura com o cartão */
export function friendlyCardError(detail: string): string {
  const d = detail.toLowerCase()
  if (d.includes('security_code') || d.includes('cvv')) return 'O código de segurança do cartão não confere. Confira e tente de novo.'
  if (d.includes('insufficient')) return 'O cartão não tem limite pra essa cobrança. Tente outro cartão.'
  if (d.includes('expir')) return 'A data de validade do cartão não confere. Confira e tente de novo.'
  if (d.includes('call_for_authorize') || d.includes('call for authorize')) return 'O banco pediu pra você autorizar a compra. Ligue pro banco ou use outro cartão.'
  return 'O cartão não foi aceito. Confira os dados ou tente outro cartão de crédito.'
}

export async function fetchPreapproval(id: string, accessToken: string): Promise<MpPreapproval | null> {
  const res = await fetch(`${MP_API}/preapproval/${encodeURIComponent(id)}`, {
    headers: mpHeaders(accessToken),
    signal: AbortSignal.timeout(10000),
  })
  return res.ok ? await res.json() as MpPreapproval : null
}

export async function fetchAuthorizedPayment(id: string, accessToken: string): Promise<MpAuthorizedPayment | null> {
  const res = await fetch(`${MP_API}/authorized_payments/${encodeURIComponent(id)}`, {
    headers: mpHeaders(accessToken),
    signal: AbortSignal.timeout(10000),
  })
  return res.ok ? await res.json() as MpAuthorizedPayment : null
}

export async function cancelPreapproval(id: string, accessToken: string): Promise<boolean> {
  const res = await fetch(`${MP_API}/preapproval/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: mpHeaders(accessToken),
    body: JSON.stringify({ status: 'cancelled' }),
    signal: AbortSignal.timeout(10000),
  })
  return res.ok
}

/** userId da assinatura, só se o external_reference for de assinatura automática do app */
export function userIdFromPreapproval(p: Pick<MpPreapproval, 'external_reference'>): string | null {
  const [userId, kind] = (p.external_reference ?? '').split('|')
  return userId && kind === AUTO_PLAN ? userId : null
}

async function patchSubscription(supabaseUrl: string, serviceKey: string, filter: string, body: Record<string, unknown>) {
  const res = await fetch(`${supabaseUrl}/rest/v1/subscriptions?${filter}`, {
    method: 'PATCH',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  })
  return res.ok
}

export type SubscriptionEventResult =
  | { ok: true; action: string }
  | { ok: false; status: number; reason: string }

/** Aviso "subscription_preapproval": assinatura criada, autorizada, pausada ou cancelada */
export async function handlePreapprovalEvent(
  preapprovalId: string,
  env: { accessToken: string; supabaseUrl: string; serviceKey: string },
): Promise<SubscriptionEventResult> {
  const pre = await fetchPreapproval(preapprovalId, env.accessToken)
  if (!pre) return { ok: false, status: 500, reason: 'mp-fetch' }
  const userId = userIdFromPreapproval(pre)
  if (!userId) return { ok: true, action: 'ignorada (não é do app)' }

  if (pre.status === 'authorized') {
    // Liga a renovação. Se a linha ainda não existe (primeira cobrança não chegou), o aviso da
    // cobrança faz isso junto com a ativação
    await patchSubscription(env.supabaseUrl, env.serviceKey, `user_id=eq.${userId}`, { mp_preapproval_id: pre.id, auto_renew: true })
    return { ok: true, action: 'renovação ligada' }
  }
  if (pre.status === 'cancelled' || pre.status === 'paused') {
    // Só desliga se for a assinatura atual da pessoa (não uma antiga cancelada depois de assinar de novo)
    await patchSubscription(env.supabaseUrl, env.serviceKey, `user_id=eq.${userId}&mp_preapproval_id=eq.${encodeURIComponent(pre.id)}`, { auto_renew: false })
    return { ok: true, action: `renovação desligada (${pre.status})` }
  }
  return { ok: true, action: `nada a fazer (${pre.status})` }
}

/** Aviso "subscription_authorized_payment": uma cobrança mensal da assinatura */
export async function handleAuthorizedPaymentEvent(
  authorizedPaymentId: string,
  env: { accessToken: string; supabaseUrl: string; serviceKey: string },
): Promise<SubscriptionEventResult> {
  const inv = await fetchAuthorizedPayment(authorizedPaymentId, env.accessToken)
  if (!inv) return { ok: false, status: 500, reason: 'mp-fetch' }
  const paymentId = inv.payment?.id
  if (inv.payment?.status !== 'approved' || !paymentId) {
    return { ok: true, action: `cobrança ainda não aprovada (${inv.status}/${inv.payment?.status ?? 'sem pagamento'})` }
  }

  const pre = await fetchPreapproval(inv.preapproval_id, env.accessToken)
  if (!pre) return { ok: false, status: 500, reason: 'mp-fetch' }
  const userId = userIdFromPreapproval(pre)
  if (!userId) return { ok: true, action: 'ignorada (não é do app)' }

  // Mesmo caminho do pagamento avulso, com o id do pagamento como chave: se o aviso "payment"
  // da mesma cobrança também chegar, activate_premium só ativa uma vez
  const result: ActivationResult = await activatePremiumFromPayment({
    id: Number(paymentId),
    status: 'approved',
    external_reference: `${userId}|${AUTO_PLAN}`,
    preference_id: pre.id,
    transaction_amount: inv.transaction_amount ?? PRICE_MONTHLY,
    payment_type_id: 'credit_card',
  }, env.supabaseUrl, env.serviceKey)
  if (!result.ok) return { ok: false, status: 500, reason: result.reason }

  await patchSubscription(env.supabaseUrl, env.serviceKey, `user_id=eq.${userId}`, {
    mp_preapproval_id: pre.id,
    auto_renew: pre.status === 'authorized',
  })
  return { ok: true, action: result.activated ? 'Premium ativado/estendido' : 'cobrança já processada' }
}
