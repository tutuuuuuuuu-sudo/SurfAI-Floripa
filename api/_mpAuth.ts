// Verificação de assinatura HMAC do Mercado Pago (header x-signature), compartilhada
// entre mp-webhook.ts e mp-ipn.ts — antes duplicada byte a byte nos dois arquivos.
// Documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
export async function verifyMpSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string | null,
  secret: string,
): Promise<boolean> {
  if (!xSignature) return false

  const parts = Object.fromEntries(xSignature.split(',').map(p => p.trim().split('=')))
  const ts = parts['ts']
  const hash = parts['v1']
  if (!ts || !hash) return false
  if (hash.length === 0 || hash.length % 2 !== 0) return false

  const manifest = `id:${dataId ?? ''};request-id:${xRequestId ?? ''};ts:${ts};`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest))
  const computedBytes = new Uint8Array(sig)

  const hashBytes = new Uint8Array(hash.length / 2)
  for (let i = 0; i < hashBytes.length; i++) {
    const byte = parseInt(hash.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) return false // hex malformado — falha fechada, não vira 0 silenciosamente
    hashBytes[i] = byte
  }
  if (computedBytes.length !== hashBytes.length) return false

  let diff = 0
  for (let i = 0; i < computedBytes.length; i++) diff |= computedBytes[i] ^ hashBytes[i]
  return diff === 0
}
