// Envio de Web Push (assinatura VAPID + criptografia RFC 8291 aes128gcm), compartilhado entre
// push-notify.ts (alertas de hora em hora) e push-test.ts (alerta de teste pedido pelo usuário).
// Movido de push-notify.ts em 30/set/2026, sem mudança de lógica. Funciona com FCM (Android/Chrome)
// e com o push da Apple (web.push.apple.com, iPhone com o app instalado na tela de início).
// Prefixo _ = não exposto como endpoint HTTP pelo Vercel.

// TS 5.7+ tornou Uint8Array genérico sobre o tipo do buffer (ArrayBufferLike inclui
// SharedArrayBuffer), o que quebra a atribuição direta às APIs de Web Crypto/fetch que
// exigem BufferSource. Não muda nada em runtime — só ajusta o tipo no limite da chamada.
function asBufferSource(u: Uint8Array): BufferSource {
  return u as unknown as BufferSource
}

export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? ''
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? ''

// ── VAPID JWT (assina o Authorization para o push service) ────────────────────

export function base64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad), c => c.charCodeAt(0))
}

export function base64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// Importa a chave VAPID privada (base64url raw 32 bytes) via JWK — sem montar DER manualmente.
// VAPID_PUBLIC_KEY é a chave pública em base64url (65 bytes uncompressed: 0x04 + x + y).
async function importVapidKey(): Promise<CryptoKey> {
  const privBytes = base64urlDecode(VAPID_PRIVATE_KEY)
  const pubBytes = base64urlDecode(VAPID_PUBLIC_KEY)
  // pubBytes = 0x04 || x (32) || y (32)
  const x = base64urlEncode(pubBytes.slice(1, 33))
  const y = base64urlEncode(pubBytes.slice(33, 65))
  const d = base64urlEncode(privBytes)
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x, y, d, key_ops: ['sign'] },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
}

export async function makeVapidJwt(audience: string): Promise<string> {
  const header = base64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = base64urlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: 'mailto:surfaifloripa@gmail.com',
  })))
  const sigInput = new TextEncoder().encode(`${header}.${payload}`)
  const cryptoKey = await importVapidKey().catch(() => null)
  if (!cryptoKey) throw new Error('VAPID key import failed')
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, sigInput)
  return `${header}.${payload}.${base64urlEncode(sig)}`
}

// ── Criptografia Web Push (RFC 8291 — AES-128-GCM) ──────────────────────────

export async function encryptWebPush(
  plaintext: string,
  clientPublicKeyB64: string,
  authSecretB64: string,
): Promise<{ body: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const enc = new TextEncoder()
  const clientPublicKeyBytes = base64urlDecode(clientPublicKeyB64)
  const authSecret = base64urlDecode(authSecretB64)

  // Gera par de chaves ECDH efêmero do servidor
  const serverKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const serverPublicKeyJwk = await crypto.subtle.exportKey('jwk', serverKeyPair.publicKey)
  const serverPublicKeyX = base64urlDecode(serverPublicKeyJwk.x!)
  const serverPublicKeyY = base64urlDecode(serverPublicKeyJwk.y!)
  const serverPublicKey = new Uint8Array(65)
  serverPublicKey[0] = 0x04
  serverPublicKey.set(serverPublicKeyX, 1)
  serverPublicKey.set(serverPublicKeyY, 33)

  // Importa chave pública do cliente para ECDH
  const clientKey = await crypto.subtle.importKey(
    'raw', asBufferSource(clientPublicKeyBytes), { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  )

  // Deriva shared secret ECDH (32 bytes)
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, serverKeyPair.privateKey, 256),
  )

  // HKDF extract+expand — pseudorandom key (RFC 8291 §3.3: info inclui chaves do receptor e remetente)
  const hkdfKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits'])
  const infoWebPush = new Uint8Array([
    ...enc.encode('WebPush: info\x00'),
    ...clientPublicKeyBytes,
    ...serverPublicKey,
  ])
  const prk = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: asBufferSource(authSecret), info: asBufferSource(infoWebPush) },
    hkdfKey, 256,
  ))

  const salt = crypto.getRandomValues(new Uint8Array(16))

  // Deriva chave de criptografia e nonce via HKDF
  const prkKey = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveBits'])
  // ERRO CORRIGIDO 01/out/2026: aqui (e no nonce) havia um 0x01 a mais no fim do info. O 0x01 da
  // RFC 8291 é o contador do HKDF-Expand, que o crypto.subtle (HKDF) já põe sozinho — com os dois,
  // a chave saía diferente da que o navegador calcula, o aparelho não conseguia abrir o pacote e
  // descartava o alerta em silêncio (a Apple/Google aceitam 201 porque não abrem o conteúdo).
  // Nenhum alerta tinha chegado a aparelho nenhum desde junho. Conferido contra a http_ece (a
  // biblioteca de referência por trás da web-push) — ver push-notify.test.ts.
  const infoBase = enc.encode('Content-Encoding: aes128gcm\x00')
  const contentKey = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: infoBase }, prkKey, 128,
  ))
  const nonceInfo = enc.encode('Content-Encoding: nonce\x00')
  const nonce = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo }, prkKey, 96,
  ))

  // Cifra o plaintext com AES-128-GCM
  const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt'])
  const plaintextPadded = new Uint8Array([...enc.encode(plaintext), 0x02]) // padding delimiter
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintextPadded),
  )

  // Monta o body RFC 8291: salt(16) + rs(4) + keylen(1) + serverPublicKey(65) + ciphertext
  const rs = 4096
  const body = new Uint8Array(16 + 4 + 1 + 65 + ciphertext.length)
  body.set(salt, 0)
  new DataView(body.buffer).setUint32(16, rs, false)
  body[20] = 65
  body.set(serverPublicKey, 21)
  body.set(ciphertext, 86)

  return { body, salt, serverPublicKey }
}

// ── Envia um push para um endpoint ───────────────────────────────────────────

// Resultado detalhado (30/set/2026): antes era só true/false e QUALQUER recusa (ex. 403 da Apple
// por um detalhe da assinatura) fazia o push-notify apagar a inscrição como se o aparelho tivesse
// sumido. Agora só 404/410 (aparelho não existe mais) contam como `gone`.
export interface PushResult {
  ok: boolean      // entregue ao serviço de push (Apple/Google)
  gone: boolean    // inscrição não existe mais: pode apagar
  status: number   // código HTTP do serviço de push (0 = nem chegou a responder)
  reason: string   // motivo da recusa, quando houver (texto do serviço de push)
}

export async function sendPush(endpoint: string, p256dh: string, auth: string, payload: string): Promise<PushResult> {
  let host = 'endereço inválido'
  try {
    const url = new URL(endpoint)
    host = url.host
    const jwt = await makeVapidJwt(url.origin)
    const { body } = await encryptWebPush(payload, p256dh, auth)
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        Authorization: `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
        TTL: '86400',
        Urgency: 'high',
      },
      body: asBufferSource(body),
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) return { ok: true, gone: false, status: res.status, reason: '' }
    const reason = (await res.text().catch(() => '')).slice(0, 300)
    console.error('[webPush] recusado', host, res.status, reason)
    return { ok: false, gone: res.status === 404 || res.status === 410, status: res.status, reason }
  } catch (err) {
    // Endpoint malformado (não é uma URL válida) nunca vai funcionar — pode apagar.
    // Qualquer outro erro (timeout, DNS instável, etc.) é transiente: mantém a inscrição.
    const malformed = err instanceof TypeError && /invalid url/i.test(err.message)
    const reason = err instanceof Error ? err.message : String(err)
    console.error('[webPush] erro', host, reason)
    return { ok: false, gone: malformed, status: 0, reason }
  }
}
