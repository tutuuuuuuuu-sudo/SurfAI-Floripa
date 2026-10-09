// Pagamento único (anual ou 1 mês avulso) feito DENTRO do app, pelo formulário completo do
// Mercado Pago ("Payment Brick": cartão de crédito, Pix e boleto) — 08/out/2026. Antes, o anual
// e o avulso mandavam a pessoa pra página do Mercado Pago (/checkout/preferences), e o usuário
// achou que esse pulo pra fora do app derruba a venda.
// O formulário entrega os dados do meio de pagamento (o cartão já vira um código de uso único,
// nunca passa por aqui); este arquivo monta o pagamento em /v1/payments com o PREÇO DO SERVIDOR
// (src/lib/pricing.ts), nunca com o valor que veio do navegador. A ativação do Premium é a mesma
// do pagamento pela página do MP: external_reference `<userId>|<plano>` + webhook (mp-webhook.ts),
// e o cartão aprovado na hora já ativa direto (create-payment.ts), sem esperar o aviso.

import { PRICE_ANNUAL, PRICE_MONTHLY, ANNUAL_MAX_INSTALLMENTS } from '../src/lib/pricing.js'

const MP_API = 'https://api.mercadopago.com'

export { ANNUAL_MAX_INSTALLMENTS }

// O que o formulário do MP entrega no envio (formData). Tudo opcional: vem do navegador
export interface BrickFormData {
  payment_method_id?: unknown
  token?: unknown
  issuer_id?: unknown
  installments?: unknown
  payer?: {
    email?: unknown
    first_name?: unknown
    last_name?: unknown
    identification?: { type?: unknown; number?: unknown }
    address?: Record<string, unknown>
  }
}

export interface MpDirectPayment {
  id: number
  status: string
  status_detail: string
  external_reference: string
  transaction_amount: number
  payment_type_id: string
  preference_id?: string
}

const str = (v: unknown, max = 120): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined

const ADDRESS_KEYS = ['zip_code', 'federal_unit', 'city', 'neighborhood', 'street_name', 'street_number'] as const

/** Monta o corpo de /v1/payments. Só passa adiante os campos conhecidos do formulário. */
export function buildDirectPayment(params: {
  plan: 'annual' | 'monthly'
  userId: string
  userEmail: string
  form: BrickFormData
  baseUrl: string
}): { ok: true; body: Record<string, unknown> } | { ok: false; error: string } {
  const { plan, userId, userEmail, form, baseUrl } = params
  const method = str(form.payment_method_id, 40)
  if (!method) return { ok: false, error: 'Escolha uma forma de pagamento.' }

  const token = str(form.token, 200)
  const isPix = method === 'pix'
  // Cartão precisa do código do cartão; Pix e boleto não
  const isCard = !!token
  if (!isCard && !isPix && !['bolbradesco', 'pec'].includes(method)) {
    return { ok: false, error: 'Forma de pagamento não aceita. Use cartão de crédito, Pix ou boleto.' }
  }

  const isAnnual = plan === 'annual'
  const maxInstallments = isAnnual ? ANNUAL_MAX_INSTALLMENTS : 1
  const asked = typeof form.installments === 'number' ? form.installments : Number(form.installments)
  const installments = Number.isInteger(asked) && asked >= 1 ? Math.min(asked, maxInstallments) : 1

  const p = form.payer ?? {}
  const payer: Record<string, unknown> = { email: str(p.email, 200) ?? userEmail }
  const firstName = str(p.first_name, 60)
  const lastName = str(p.last_name, 60)
  if (firstName) payer.first_name = firstName
  if (lastName) payer.last_name = lastName
  const docType = str(p.identification?.type, 10)
  const docNumber = str(p.identification?.number, 20)
  if (docType && docNumber) payer.identification = { type: docType, number: docNumber.replace(/\D/g, '') }
  if (p.address && typeof p.address === 'object') {
    const address: Record<string, string> = {}
    for (const k of ADDRESS_KEYS) {
      const v = str(p.address[k], 80)
      if (v) address[k] = v
    }
    if (Object.keys(address).length) payer.address = address
  }

  const title = isAnnual ? 'Surf AI Premium Anual' : 'Surf AI Premium Mensal'
  const amount = isAnnual ? PRICE_ANNUAL : PRICE_MONTHLY
  const body: Record<string, unknown> = {
    transaction_amount: amount,
    description: title,
    payment_method_id: method,
    payer,
    external_reference: `${userId}|${plan}`,
    notification_url: `${baseUrl}/api/mp-webhook`,
    statement_descriptor: 'SURF AI FLORIPA',
    additional_info: {
      items: [{
        id: isAnnual ? 'surf-ai-premium-anual' : 'surf-ai-premium-mensal',
        title,
        description: isAnnual ? 'Acesso completo ao Surf AI Floripa por 12 meses' : 'Acesso completo ao Surf AI Floripa por 30 dias',
        category_id: 'services',
        quantity: 1,
        unit_price: amount,
      }],
    },
  }
  if (isCard) {
    body.token = token
    body.installments = installments
    const issuer = str(String(form.issuer_id ?? ''), 20)
    if (issuer) body.issuer_id = issuer
  }
  return { ok: true, body }
}

/** Cria o pagamento. idempotencyKey evita cobrar duas vezes se o mesmo envio chegar repetido;
 *  deviceId (security.js do MP) ajuda o antifraude do MP a aprovar o cartão. */
export async function createDirectPayment(body: Record<string, unknown>, opts: {
  accessToken: string
  idempotencyKey: string
  deviceId?: string
}): Promise<{ ok: true; payment: MpDirectPayment } | { ok: false; status: number; detail: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${opts.accessToken}`,
    'X-Idempotency-Key': opts.idempotencyKey,
  }
  if (opts.deviceId) headers['X-meli-session-id'] = opts.deviceId
  const res = await fetch(`${MP_API}/v1/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) return { ok: false, status: res.status, detail: (await res.text()).slice(0, 500) }
  return { ok: true, payment: await res.json() as MpDirectPayment }
}

/** Motivo da recusa em português, a partir do status_detail do MP */
export function friendlyPaymentError(statusDetail: string): string {
  const d = statusDetail.toLowerCase()
  if (d.includes('security_code')) return 'O código de segurança do cartão não confere. Confira e tente de novo.'
  if (d.includes('bad_filled_date')) return 'A data de validade do cartão não confere. Confira e tente de novo.'
  if (d.includes('bad_filled')) return 'Algum dado do cartão não confere. Confira e tente de novo.'
  if (d.includes('insufficient_amount')) return 'O cartão não tem limite pra essa compra. Tente outro cartão ou pague com Pix.'
  if (d.includes('call_for_authorize')) return 'O banco pediu pra você autorizar a compra. Ligue pro banco ou use outro cartão.'
  if (d.includes('card_disabled')) return 'Esse cartão está bloqueado. Ligue pro banco ou use outro cartão.'
  if (d.includes('duplicated_payment')) return 'Esse pagamento já foi feito agora há pouco. Confira seu Premium antes de tentar de novo.'
  if (d.includes('max_attempts')) return 'Muitas tentativas com esse cartão. Use outro cartão ou pague com Pix.'
  if (d.includes('high_risk') || d.includes('blacklist')) return 'O pagamento foi recusado pela análise de segurança. Tente outro cartão ou pague com Pix.'
  return 'O pagamento foi recusado. Tente outro cartão ou pague com Pix.'
}
