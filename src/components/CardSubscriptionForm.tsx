import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { Loader2 } from 'lucide-react'
import { PRICE_MONTHLY, formatBRL } from '@/lib/pricing'
import { subscribeWithCard, MP_PUBLIC_KEY } from '@/lib/premium'

// Formulário de cartão do próprio Mercado Pago ("Card Payment Brick") dentro da página Premium,
// pra assinar o mensal com renovação automática sem precisar de conta no Mercado Pago (02/out/2026).
// O número do cartão é digitado em campos do MP e vira um código de uso único (token) — nunca passa
// pelo nosso servidor. O servidor usa esse código pra criar a assinatura (api/_mpSubscription.ts).

const SDK_URL = 'https://sdk.mercadopago.com/js/v2'
const CONTAINER_ID = 'mp-card-brick'

interface CardFormData {
  token: string
  payer?: { email?: string }
}
interface BrickController { unmount: () => void }
interface MercadoPagoInstance {
  bricks: () => { create: (type: 'cardPayment', containerId: string, settings: unknown) => Promise<BrickController> }
}
declare global {
  interface Window { MercadoPago?: new (key: string, opts: { locale: string }) => MercadoPagoInstance }
}

// O formulário do MP só aceita cor em hex, e o tema do app é em oklch (index.css): converte na
// hora, pra ele ter a cara do app (fundo do card, campos, botão turquesa) nos dois temas
function themeHex(name: string): string | undefined {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()
  const ctx = value ? document.createElement('canvas').getContext('2d') : null
  if (!ctx) return undefined
  ctx.fillStyle = value
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

function brickColors() {
  const vars: Record<string, string> = {
    formBackgroundColor: 'card', inputBackgroundColor: 'background', textPrimaryColor: 'foreground',
    textSecondaryColor: 'muted-foreground', secondaryBackgroundColor: 'muted', tertiaryBackgroundColor: 'muted',
    baseColor: 'primary', buttonTextColor: 'primary-foreground', outlinePrimaryColor: 'border', errorColor: 'destructive',
  }
  const out: Record<string, string> = { formPadding: '0px', borderRadiusSmall: '8px', borderRadiusMedium: '12px', borderRadiusLarge: '12px' }
  for (const [key, cssVar] of Object.entries(vars)) {
    const hex = themeHex(cssVar)
    if (hex) out[key] = hex
  }
  return out
}

let sdkPromise: Promise<void> | null = null
function loadSdk(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve()
  if (!sdkPromise) {
    sdkPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SDK_URL
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => { sdkPromise = null; reject(new Error('Mercado Pago SDK não carregou')) }
      document.head.appendChild(script)
    })
  }
  return sdkPromise
}

export function CardSubscriptionForm({ email, onSubscribed }: { email: string; onSubscribed: () => void }) {
  const { resolvedTheme } = useTheme()
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const onSubscribedRef = useRef(onSubscribed)
  useEffect(() => { onSubscribedRef.current = onSubscribed }, [onSubscribed])

  useEffect(() => {
    if (!MP_PUBLIC_KEY) return
    const publicKey = MP_PUBLIC_KEY
    let controller: BrickController | null = null
    let cancelled = false

    loadSdk()
      .then(async () => {
        if (cancelled || !window.MercadoPago) return
        const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' })
        const created = await mp.bricks().create('cardPayment', CONTAINER_ID, {
          initialization: { amount: PRICE_MONTHLY, payer: { email } },
          customization: {
            visual: {
              style: { theme: resolvedTheme === 'light' ? 'default' : 'dark', customVariables: brickColors() },
              // Título padrão do MP diz "crédito ou débito" mesmo com débito excluído
              texts: { formTitle: 'Cartão de crédito', formSubmit: `Assinar por ${formatBRL(PRICE_MONTHLY)}/mês` },
            },
            // Assinatura só funciona com cartão de crédito, cobrado à vista todo mês
            paymentMethods: { minInstallments: 1, maxInstallments: 1, types: { excluded: ['debit_card', 'prepaid_card'] } },
          },
          callbacks: {
            onReady: () => { if (!cancelled) setStatus('ready') },
            onError: (err: unknown) => console.error('[CardSubscriptionForm]', err),
            onSubmit: async (data: CardFormData) => {
              setSubmitError(null)
              const result = await subscribeWithCard({ cardToken: data.token, payerEmail: data.payer?.email || email })
              if (!result.ok) {
                setSubmitError(result.error ?? 'O cartão não foi aceito. Confira os dados ou tente outro cartão.')
                throw new Error(result.error) // devolve o botão do formulário pra tentar de novo
              }
              onSubscribedRef.current()
            },
          },
        })
        // Saiu da tela (ou o React montou duas vezes) antes do formulário terminar de abrir
        if (cancelled) created.unmount()
        else controller = created
      })
      .catch(() => { if (!cancelled) setStatus('error') })

    return () => {
      cancelled = true
      controller?.unmount()
    }
  }, [email, resolvedTheme])

  if (!MP_PUBLIC_KEY) return null

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground leading-relaxed">
        {formatBRL(PRICE_MONTHLY)} no cartão de crédito todo mês, de qualquer banco. Não precisa de conta no Mercado Pago. Cancele quando quiser em Configurações.
      </p>
      {status === 'loading' && (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />Abrindo o formulário seguro do Mercado Pago...
        </div>
      )}
      {status === 'error' && (
        <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 text-center">
          Não deu pra abrir o formulário do cartão. Confira a internet e recarregue a página, ou pague 1 mês avulso abaixo.
        </div>
      )}
      <div id={CONTAINER_ID} />
      {submitError && (
        <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 text-center">{submitError}</div>
      )}
    </div>
  )
}
