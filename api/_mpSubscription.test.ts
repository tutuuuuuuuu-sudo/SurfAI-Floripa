import { describe, it, expect, vi, afterEach } from 'vitest'
import { userIdFromPreapproval, handleAuthorizedPaymentEvent, handlePreapprovalEvent, createPreapproval, friendlyCardError, AUTO_PLAN } from './_mpSubscription'

const env = { accessToken: 'APP_USR-x', supabaseUrl: 'https://db.test', serviceKey: 'svc' }
const USER = '11111111-2222-4333-8444-555555555555'

interface Call { url: string; method: string; body: unknown }

// Simula Mercado Pago + banco: responde por URL e guarda o que foi pedido
function fakeFetch(routes: Record<string, unknown>) {
  const calls: Call[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    const key = Object.keys(routes).find(k => url.includes(k))
    if (!key) return new Response('{}', { status: 200 })
    return new Response(JSON.stringify(routes[key]), { status: 200 })
  }))
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('userIdFromPreapproval', () => {
  it('só aceita assinatura automática do app', () => {
    expect(userIdFromPreapproval({ external_reference: `${USER}|${AUTO_PLAN}` })).toBe(USER)
    expect(userIdFromPreapproval({ external_reference: `${USER}|monthly` })).toBeNull()
    expect(userIdFromPreapproval({ external_reference: undefined })).toBeNull()
  })
})

describe('cobrança mensal (subscription_authorized_payment)', () => {
  it('aprovada: ativa 31 dias de mensal com o id do pagamento e liga a renovação', async () => {
    const calls = fakeFetch({
      '/authorized_payments/77': { id: 77, preapproval_id: 'pre1', status: 'processed', transaction_amount: 22.9, payment: { id: 9001, status: 'approved' } },
      '/preapproval/pre1': { id: 'pre1', status: 'authorized', external_reference: `${USER}|${AUTO_PLAN}` },
      '/rpc/activate_premium': true,
    })
    const r = await handleAuthorizedPaymentEvent('77', env)
    expect(r).toEqual({ ok: true, action: 'Premium ativado/estendido' })

    const rpc = calls.find(c => c.url.includes('/rpc/activate_premium'))!
    expect(rpc.body).toMatchObject({ p_user_id: USER, p_mp_payment_id: '9001', p_duration_days: 31, p_plan: 'monthly', p_amount: 22.9 })

    const patch = calls.find(c => c.method === 'PATCH')!
    expect(patch.url).toContain(`user_id=eq.${USER}`)
    expect(patch.body).toEqual({ mp_preapproval_id: 'pre1', auto_renew: true })
  })

  it('ainda não aprovada (cartão recusado, MP vai tentar de novo): não ativa nada', async () => {
    const calls = fakeFetch({
      '/authorized_payments/78': { id: 78, preapproval_id: 'pre1', status: 'recycling', payment: { id: 9002, status: 'rejected' } },
    })
    const r = await handleAuthorizedPaymentEvent('78', env)
    expect(r.ok).toBe(true)
    expect(calls.some(c => c.url.includes('activate_premium'))).toBe(false)
  })

  it('assinatura que não é do app: ignora', async () => {
    const calls = fakeFetch({
      '/authorized_payments/79': { id: 79, preapproval_id: 'outra', status: 'processed', payment: { id: 9003, status: 'approved' } },
      '/preapproval/outra': { id: 'outra', status: 'authorized', external_reference: 'qualquer-coisa' },
    })
    const r = await handleAuthorizedPaymentEvent('79', env)
    expect(r).toEqual({ ok: true, action: 'ignorada (não é do app)' })
    expect(calls.some(c => c.url.includes('activate_premium'))).toBe(false)
  })
})

describe('assinatura mudou de status (subscription_preapproval)', () => {
  it('cancelada: desliga a renovação só se for a assinatura atual da pessoa', async () => {
    const calls = fakeFetch({
      '/preapproval/pre1': { id: 'pre1', status: 'cancelled', external_reference: `${USER}|${AUTO_PLAN}` },
    })
    await handlePreapprovalEvent('pre1', env)
    const patch = calls.find(c => c.method === 'PATCH')!
    expect(patch.url).toContain(`user_id=eq.${USER}`)
    expect(patch.url).toContain('mp_preapproval_id=eq.pre1')
    expect(patch.body).toEqual({ auto_renew: false })
  })

  it('autorizada: liga a renovação', async () => {
    const calls = fakeFetch({
      '/preapproval/pre2': { id: 'pre2', status: 'authorized', external_reference: `${USER}|${AUTO_PLAN}` },
    })
    await handlePreapprovalEvent('pre2', env)
    expect(calls.find(c => c.method === 'PATCH')!.body).toEqual({ mp_preapproval_id: 'pre2', auto_renew: true })
  })
})

describe('criar assinatura', () => {
  it('com o cartão do formulário do app: já nasce autorizada, sem página do MP', async () => {
    const calls = fakeFetch({ '/preapproval': { id: 'pre9', status: 'authorized' } })
    const r = await createPreapproval({ accessToken: 'APP_USR-x', userId: USER, payerEmail: 'a@b.com', backUrl: 'https://x/premium', cardTokenId: 'tok123' })
    expect(r).toEqual({ ok: true, id: 'pre9', status: 'authorized', initPoint: null })
    expect(calls[0].body).toMatchObject({ card_token_id: 'tok123', status: 'authorized', external_reference: `${USER}|${AUTO_PLAN}`, auto_recurring: { transaction_amount: 22.9, frequency: 1, frequency_type: 'months' } })
  })

  it('sem cartão: nasce pendente e devolve a página de assinatura do MP', async () => {
    const calls = fakeFetch({ '/preapproval': { id: 'pre10', status: 'pending', init_point: 'https://mp/checkout' } })
    const r = await createPreapproval({ accessToken: 'APP_USR-x', userId: USER, payerEmail: 'a@b.com', backUrl: 'https://x/premium' })
    expect(r).toEqual({ ok: true, id: 'pre10', status: 'pending', initPoint: 'https://mp/checkout' })
    expect(calls[0].body).toMatchObject({ status: 'pending' })
    expect((calls[0].body as Record<string, unknown>).card_token_id).toBeUndefined()
  })

  it('mensagem de cartão recusado em português claro', () => {
    expect(friendlyCardError('{"message":"cc_rejected_bad_filled_security_code"}')).toContain('código de segurança')
    expect(friendlyCardError('cc_rejected_insufficient_amount')).toContain('limite')
    expect(friendlyCardError('qualquer outra coisa')).toContain('não foi aceito')
  })
})
