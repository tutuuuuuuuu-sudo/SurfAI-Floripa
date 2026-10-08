import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { Loader2 } from 'lucide-react'
import { PRICE_ANNUAL, PRICE_MONTHLY, ANNUAL_MAX_INSTALLMENTS, formatBRL } from '@/lib/pricing'
import { payOnce, MP_PUBLIC_KEY } from '@/lib/premium'
import { loadMercadoPagoSdk, loadMercadoPagoDeviceId, mercadoPagoDeviceId, brickColors, type BrickController } from '@/lib/mercadoPagoSdk'

// Anual e 1 mês avulso pagos DENTRO do app (08/out/2026), com o formulário completo do Mercado
// Pago ("Payment Brick"): cartão de crédito, Pix e boleto. Antes esses dois planos mandavam a
// pessoa pra página do MP, e o usuário achou que esse pulo pra fora derruba a venda.
// Depois do envio: cartão aprovado libera o Premium na hora (o servidor já ativa); Pix e boleto
// trocam o formulário pela tela de status do MP ("Status Screen Brick"), que mostra o QR code /
// boleto, e o Premium libera sozinho quando o pagamento cair (webhook + realtime do usePremium).
// Parcelas do anual: ANNUAL_MAX_INSTALLMENTS em src/lib/pricing.ts.

const FORM_ID = 'mp-payment-brick'
const STATUS_ID = 'mp-status-brick'

interface PaymentSubmit { formData: unknown }

export function OneTimePaymentForm({ plan, email, onApproved }: {
  plan: 'monthly' | 'annual'
  email: string
  onApproved: () => void
}) {
  const { resolvedTheme } = useTheme()
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Pagamento criado e esperando (Pix/boleto/análise): mostra a tela de status do MP
  const [pendingId, setPendingId] = useState<number | null>(null)
  const onApprovedRef = useRef(onApproved)
  useEffect(() => { onApprovedRef.current = onApproved }, [onApproved])

  const amount = plan === 'annual' ? PRICE_ANNUAL : PRICE_MONTHLY

  // Formulário de pagamento
  useEffect(() => {
    if (!MP_PUBLIC_KEY || pendingId) return
    const publicKey = MP_PUBLIC_KEY
    let controller: BrickController | null = null
    let cancelled = false
    loadMercadoPagoDeviceId()

    loadMercadoPagoSdk()
      .then(async () => {
        if (cancelled || !window.MercadoPago) return
        const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' })
        const created = await mp.bricks().create('payment', FORM_ID, {
          initialization: { amount, payer: { email } },
          customization: {
            visual: {
              style: { theme: resolvedTheme === 'light' ? 'default' : 'dark', customVariables: brickColors() },
              texts: { formSubmit: plan === 'annual' ? `Pagar ${formatBRL(PRICE_ANNUAL)}` : `Pagar ${formatBRL(PRICE_MONTHLY)}` },
            },
            paymentMethods: { creditCard: 'all', bankTransfer: 'all', ticket: 'all', maxInstallments: plan === 'annual' ? ANNUAL_MAX_INSTALLMENTS : 1 },
          },
          callbacks: {
            onReady: () => { if (!cancelled) setStatus('ready') },
            onError: (err: unknown) => console.error('[OneTimePaymentForm]', err),
            onSubmit: async ({ formData }: PaymentSubmit) => {
              setSubmitError(null)
              const result = await payOnce({ plan, formData, idempotencyKey: crypto.randomUUID(), deviceId: mercadoPagoDeviceId() })
              if (!result.ok) {
                setSubmitError(result.error)
                throw new Error(result.error) // devolve o botão do formulário pra tentar de novo
              }
              if (result.status === 'approved') onApprovedRef.current()
              else setPendingId(result.id)
            },
          },
        })
        if (cancelled) created.unmount()
        else controller = created
      })
      .catch(() => { if (!cancelled) setStatus('error') })

    return () => {
      cancelled = true
      controller?.unmount()
    }
  }, [amount, email, plan, resolvedTheme, pendingId])

  // Tela de status (QR code do Pix, boleto ou análise do cartão)
  useEffect(() => {
    if (!MP_PUBLIC_KEY || !pendingId) return
    const publicKey = MP_PUBLIC_KEY
    let controller: BrickController | null = null
    let cancelled = false
    loadMercadoPagoSdk()
      .then(async () => {
        if (cancelled || !window.MercadoPago) return
        const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' })
        const created = await mp.bricks().create('statusScreen', STATUS_ID, {
          initialization: { paymentId: String(pendingId) },
          customization: { visual: { style: { theme: resolvedTheme === 'light' ? 'default' : 'dark', customVariables: brickColors() } } },
          callbacks: { onReady: () => {}, onError: (err: unknown) => console.error('[OneTimePaymentForm status]', err) },
        })
        if (cancelled) created.unmount()
        else controller = created
      })
      .catch(() => {})
    return () => {
      cancelled = true
      controller?.unmount()
    }
  }, [pendingId, resolvedTheme])

  if (!MP_PUBLIC_KEY) return null

  if (pendingId) {
    return (
      <div className="space-y-3">
        <p className="text-center text-sm text-muted-foreground">
          Assim que o pagamento cair, seu Premium libera aqui sozinho.
        </p>
        <div id={STATUS_ID} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {status === 'loading' && (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />Abrindo o pagamento seguro do Mercado Pago...
        </div>
      )}
      {status === 'error' && (
        <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 text-center">
          Não deu pra abrir o pagamento. Confira a internet e recarregue a página.
        </div>
      )}
      <div id={FORM_ID} />
      {submitError && (
        <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 text-center">{submitError}</div>
      )}
    </div>
  )
}
