import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildDirectPayment, createDirectPayment, friendlyPaymentError, ANNUAL_MAX_INSTALLMENTS } from './_mpDirectPayment'
import { PRICE_ANNUAL, PRICE_MONTHLY } from '../src/lib/pricing'

const USER = '11111111-2222-4333-8444-555555555555'
const base = { userId: USER, userEmail: 'app@ex.com', baseUrl: 'https://app.test' }

afterEach(() => vi.unstubAllGlobals())

describe('buildDirectPayment', () => {
  it('cartão no anual: preço do servidor, nunca o do navegador, e referência pro webhook', () => {
    const r = buildDirectPayment({
      ...base, plan: 'annual',
      form: { payment_method_id: 'master', token: 'tok123', issuer_id: 24, installments: 1, payer: { email: 'pagador@ex.com', identification: { type: 'CPF', number: '123.456.789-09' } }, transaction_amount: 1 } as never,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.body.transaction_amount).toBe(PRICE_ANNUAL)
    expect(r.body.external_reference).toBe(`${USER}|annual`)
    expect(r.body.notification_url).toBe('https://app.test/api/mp-webhook')
    expect(r.body.token).toBe('tok123')
    expect(r.body.issuer_id).toBe('24')
    expect(r.body.payer).toEqual({ email: 'pagador@ex.com', identification: { type: 'CPF', number: '12345678909' } })
  })

  it('Pix no mensal avulso: sem token nem parcelas, e-mail do app se o formulário não mandar', () => {
    const r = buildDirectPayment({ ...base, plan: 'monthly', form: { payment_method_id: 'pix' } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.body.transaction_amount).toBe(PRICE_MONTHLY)
    expect(r.body.external_reference).toBe(`${USER}|monthly`)
    expect(r.body).not.toHaveProperty('token')
    expect(r.body).not.toHaveProperty('installments')
    expect(r.body.payer).toEqual({ email: 'app@ex.com' })
  })

  it('boleto leva nome e endereço, só com os campos conhecidos', () => {
    const r = buildDirectPayment({
      ...base, plan: 'annual',
      form: { payment_method_id: 'bolbradesco', payer: { first_name: 'Ana', last_name: 'Silva', address: { zip_code: '88000000', city: 'Florianópolis', hack: 'x' } } },
    })
    expect(r.ok && r.body.payer).toEqual({ email: 'app@ex.com', first_name: 'Ana', last_name: 'Silva', address: { zip_code: '88000000', city: 'Florianópolis' } })
  })

  it('parcelas acima do permitido caem pro máximo do plano', () => {
    const annual = buildDirectPayment({ ...base, plan: 'annual', form: { payment_method_id: 'visa', token: 't', installments: 24 } })
    const monthly = buildDirectPayment({ ...base, plan: 'monthly', form: { payment_method_id: 'visa', token: 't', installments: 3 } })
    expect(annual.ok && annual.body.installments).toBe(ANNUAL_MAX_INSTALLMENTS)
    expect(monthly.ok && monthly.body.installments).toBe(1)
  })

  it('recusa forma de pagamento desconhecida ou vazia', () => {
    expect(buildDirectPayment({ ...base, plan: 'annual', form: {} }).ok).toBe(false)
    expect(buildDirectPayment({ ...base, plan: 'annual', form: { payment_method_id: 'account_money' } }).ok).toBe(false)
  })
})

describe('createDirectPayment', () => {
  it('manda a chave anti-duplicidade e o id do aparelho', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 1, status: 'approved' }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const r = await createDirectPayment({ a: 1 }, { accessToken: 'APP_USR-x', idempotencyKey: 'k1', deviceId: 'dev' })
    expect(r.ok).toBe(true)
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
    const headers = init.headers as Record<string, string>
    expect(headers['X-Idempotency-Key']).toBe('k1')
    expect(headers['X-meli-session-id']).toBe('dev')
  })

  it('erro do MP volta com o detalhe pra log', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"message":"invalid token"}', { status: 400 })))
    const r = await createDirectPayment({}, { accessToken: 'x', idempotencyKey: 'k' })
    expect(r).toEqual({ ok: false, status: 400, detail: '{"message":"invalid token"}' })
  })
})

describe('friendlyPaymentError', () => {
  it('explica as recusas mais comuns', () => {
    expect(friendlyPaymentError('cc_rejected_insufficient_amount')).toContain('limite')
    expect(friendlyPaymentError('cc_rejected_bad_filled_security_code')).toContain('código de segurança')
    expect(friendlyPaymentError('cc_rejected_call_for_authorize')).toContain('autorizar')
    expect(friendlyPaymentError('qualquer_outra')).toContain('recusado')
  })
})
