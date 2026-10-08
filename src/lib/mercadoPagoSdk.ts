// SDK do Mercado Pago no navegador, compartilhado pelos dois formulários dentro do app:
// CardSubscriptionForm (mensal com renovação, só cartão) e OneTimePaymentForm (anual e 1 mês
// avulso: cartão, Pix e boleto). Carrega o SDK uma vez só, o security.js do MP (identifica o
// aparelho pro antifraude aprovar mais cartões) e converte as cores do tema pro formulário.

const SDK_URL = 'https://sdk.mercadopago.com/js/v2'
const SECURITY_URL = 'https://www.mercadopago.com/v2/security.js'

export interface BrickController { unmount: () => void }
interface MercadoPagoInstance {
  bricks: () => { create: (type: 'cardPayment' | 'payment' | 'statusScreen', containerId: string, settings: unknown) => Promise<BrickController> }
}
declare global {
  interface Window {
    MercadoPago?: new (key: string, opts: { locale: string }) => MercadoPagoInstance
    MP_DEVICE_SESSION_ID?: string
  }
}

let sdkPromise: Promise<void> | null = null
export function loadMercadoPagoSdk(): Promise<void> {
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

/** Liga o security.js do MP (cria window.MP_DEVICE_SESSION_ID). Se não carregar, o pagamento
 *  segue sem ele — só perde a ajuda no antifraude. */
export function loadMercadoPagoDeviceId(): void {
  if (document.querySelector(`script[src="${SECURITY_URL}"]`)) return
  const script = document.createElement('script')
  script.src = SECURITY_URL
  script.async = true
  script.setAttribute('view', 'checkout')
  document.head.appendChild(script)
}

export const mercadoPagoDeviceId = (): string | undefined => window.MP_DEVICE_SESSION_ID || undefined

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

export function brickColors() {
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
