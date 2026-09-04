// Busca de pagamento no Mercado Pago + ativação de premium — fonte única usada por
// mp-webhook.ts (webhook atual) e mp-ipn.ts (IPN legado), que antes duplicavam essa
// lógica quase byte a byte (achado da auditoria de 22/ago/2026). Prefixo _ indica que
// não é um handler HTTP — não será exposto como endpoint pelo Vercel.

export interface MpPayment {
  id: number
  status: string
  external_reference: string
  preference_id: string
  transaction_amount: number
  payment_type_id: string
}

export async function fetchMpPayment(paymentId: string, accessToken: string): Promise<MpPayment | null> {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return null
  return await res.json() as MpPayment
}

export type ActivationResult =
  | { ok: true; activated: boolean; userId: string }
  | { ok: false; reason: 'missing-userid' }
  | { ok: false; reason: 'rpc-error'; detail: string }

// Idempotência garantida atomicamente pelo banco (activate_premium só ativa se
// mp_payment_id ainda não existir em payments) — webhook e IPN podem processar o
// mesmo pagamento em paralelo, mas só um dos dois vence.
export async function activatePremiumFromPayment(
  payment: MpPayment,
  supabaseUrl: string,
  serviceKey: string
): Promise<ActivationResult> {
  const [userId, plan] = (payment.external_reference ?? '').split('|')
  if (!userId) return { ok: false, reason: 'missing-userid' }

  const durationDays = plan === 'annual' ? 365 : 30

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
      p_duration_days: durationDays,
      p_plan: plan === 'annual' ? 'annual' : 'monthly',
    }),
    signal: AbortSignal.timeout(10000),
  })

  if (!rpcRes.ok) return { ok: false, reason: 'rpc-error', detail: await rpcRes.text() }
  const activated = await rpcRes.json() as boolean
  return { ok: true, activated, userId }
}
