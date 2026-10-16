// @vitest-environment node
//
// Testa a criptografia Web Push (RFC 8291) e a assinatura VAPID (RFC 8292) implementadas
// à mão em push-notify.ts — o trecho de código mais complexo e, até aqui, o único sem
// nenhuma cobertura automatizada no backend (webhooks de pagamento à parte, ver _mpAuth.test.ts).
//
// A verificação é de ponta a ponta: gera um par de chaves ECDH "do cliente" (como um navegador
// faria ao se inscrever em push), chama encryptWebPush() como o servidor faria, e então decifra
// o resultado seguindo o RFC 8291 do lado do cliente — usando SOMENTE Web Crypto, sem reimportar
// nada do módulo além do que ele exporta. Se o payload decifrado bater com o original, a
// implementação está de fato interoperável com um push service real (é isso que importa —
// checar só o formato do byte array não pegaria um erro de ordem de bytes ou de info string).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHmac } from 'node:crypto'

// TS 5.7+ tornou Uint8Array genérico sobre o tipo do buffer — ver comentário equivalente em push-notify.ts
function asBufferSource(u: Uint8Array): BufferSource {
  return u as unknown as BufferSource
}

function localB64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function localB64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad), c => c.charCodeAt(0))
}

let mod: typeof import('./push-notify')
let vapidPublicKeyB64: string
let vapidPublicKey: CryptoKey
const originalEnv = { pub: process.env.VAPID_PUBLIC_KEY, priv: process.env.VAPID_PRIVATE_KEY }

beforeAll(async () => {
  // Gera um par VAPID real (P-256) e injeta nas env vars ANTES de importar o módulo,
  // já que ele lê process.env em constantes de topo no momento do import.
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const pubJwk = await crypto.subtle.exportKey('jwk', kp.publicKey) as JsonWebKey
  const privJwk = await crypto.subtle.exportKey('jwk', kp.privateKey) as JsonWebKey

  const pubBytes = new Uint8Array(65)
  pubBytes[0] = 0x04
  pubBytes.set(localB64urlDecode(pubJwk.x!), 1)
  pubBytes.set(localB64urlDecode(pubJwk.y!), 33)

  vapidPublicKeyB64 = localB64urlEncode(pubBytes)
  vapidPublicKey = kp.publicKey

  process.env.VAPID_PUBLIC_KEY = vapidPublicKeyB64
  process.env.VAPID_PRIVATE_KEY = privJwk.d!

  mod = await import('./push-notify')
})

afterAll(() => {
  process.env.VAPID_PUBLIC_KEY = originalEnv.pub
  process.env.VAPID_PRIVATE_KEY = originalEnv.priv
})

describe('base64url encode/decode', () => {
  it('round-trip preserva bytes arbitrários, incluindo os que geram padding', () => {
    for (const len of [0, 1, 2, 3, 4, 16, 65]) {
      const original = crypto.getRandomValues(new Uint8Array(len))
      const decoded = mod.base64urlDecode(mod.base64urlEncode(original))
      expect([...decoded]).toEqual([...original])
    }
  })

  it('não produz caracteres +, / ou = (alfabeto base64url puro)', () => {
    const bytes = new Uint8Array([255, 254, 253, 0, 1, 2, 62, 63])
    const encoded = mod.base64urlEncode(bytes)
    expect(encoded).not.toMatch(/[+/=]/)
  })
})

describe('makeVapidJwt', () => {
  it('gera um JWT ES256 com header/payload corretos e assinatura verificável pela chave pública', async () => {
    const audience = 'https://fcm.googleapis.com'
    const jwt = await mod.makeVapidJwt(audience)
    const [headerB64, payloadB64, sigB64] = jwt.split('.')
    expect(headerB64 && payloadB64 && sigB64).toBeTruthy()

    const header = JSON.parse(new TextDecoder().decode(mod.base64urlDecode(headerB64)))
    expect(header).toEqual({ typ: 'JWT', alg: 'ES256' })

    const payload = JSON.parse(new TextDecoder().decode(mod.base64urlDecode(payloadB64)))
    expect(payload.aud).toBe(audience)
    expect(payload.sub).toBe('mailto:surfaifloripa@gmail.com')
    const nowSec = Math.floor(Date.now() / 1000)
    expect(payload.exp).toBeGreaterThan(nowSec)
    expect(payload.exp).toBeLessThanOrEqual(nowSec + 12 * 3600 + 5)

    // Verificação criptográfica real da assinatura com a chave pública VAPID gerada no beforeAll —
    // não só checagem de formato. crypto.subtle produz assinatura ECDSA em formato raw (IEEE P1363,
    // r||s de 64 bytes), que é exatamente o que JWS ES256 espera — sem conversão DER necessária.
    const signedInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    const sigBytes = mod.base64urlDecode(sigB64)
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      vapidPublicKey,
      asBufferSource(sigBytes),
      signedInput,
    )
    expect(valid).toBe(true)
  })

  it('rejeita verificação com uma chave pública diferente (assinatura não é forjável)', async () => {
    const jwt = await mod.makeVapidJwt('https://example.com')
    const [headerB64, payloadB64, sigB64] = jwt.split('.')
    const otherKp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const signedInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      otherKp.publicKey,
      asBufferSource(mod.base64urlDecode(sigB64)),
      signedInput,
    )
    expect(valid).toBe(false)
  })
})

describe('encryptWebPush (RFC 8291)', () => {
  // Decifra do lado "cliente" escrevendo a RFC 8291 ao pé da letra, com HMAC-SHA-256 puro (node:crypto)
  // — de propósito NÃO usa o HKDF do crypto.subtle como o servidor usa. Até 01/out/2026 este teste
  // espelhava o mesmo código do servidor, inclusive o erro (um 0x01 a mais no info do HKDF): os dois
  // lados erravam igual, o teste passava e nenhum aparelho conseguia abrir os alertas. Conferido
  // também contra a http_ece (biblioteca de referência da web-push).
  async function decryptAsClient(
    body: Uint8Array,
    clientPrivateKey: CryptoKey,
    clientPublicKeyBytes: Uint8Array,
    authSecret: Uint8Array,
  ): Promise<string> {
    const enc = new TextEncoder()
    const hmac = (key: Uint8Array, data: Uint8Array) =>
      new Uint8Array(createHmac('sha256', key).update(data).digest())
    const salt = body.slice(0, 16)
    const keyLen = body[20]
    expect(keyLen).toBe(65)
    const serverPublicKeyBytes = body.slice(21, 21 + 65)
    const ciphertext = body.slice(21 + 65)

    const serverPublicKey = await crypto.subtle.importKey(
      'raw', serverPublicKeyBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
    )
    const ecdhSecret = new Uint8Array(
      await crypto.subtle.deriveBits({ name: 'ECDH', public: serverPublicKey }, clientPrivateKey, 256),
    )

    // RFC 8291 §3.4: PRK_key = HMAC(auth_secret, ecdh_secret); IKM = HMAC(PRK_key, key_info || 0x01)
    const prkKey = hmac(authSecret, ecdhSecret)
    const keyInfo = new Uint8Array([...enc.encode('WebPush: info\x00'), ...clientPublicKeyBytes, ...serverPublicKeyBytes])
    const ikm = hmac(prkKey, new Uint8Array([...keyInfo, 0x01]))
    // PRK = HMAC(salt, IKM); CEK = HMAC(PRK, cek_info || 0x01)[0..16]; NONCE = HMAC(PRK, nonce_info || 0x01)[0..12]
    const prk = hmac(salt, ikm)
    const contentKey = hmac(prk, new Uint8Array([...enc.encode('Content-Encoding: aes128gcm\x00'), 0x01])).slice(0, 16)
    const nonce = hmac(prk, new Uint8Array([...enc.encode('Content-Encoding: nonce\x00'), 0x01])).slice(0, 12)

    const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['decrypt'])
    const plaintextPadded = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aesKey, ciphertext),
    )
    // Remove o delimitador de padding (0x02) que encryptWebPush adiciona ao final
    expect(plaintextPadded[plaintextPadded.length - 1]).toBe(0x02)
    return new TextDecoder().decode(plaintextPadded.slice(0, -1))
  }

  it('payload decifrado do lado do cliente bate exatamente com o texto original', async () => {
    const clientKp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
    const clientPubJwk = await crypto.subtle.exportKey('jwk', clientKp.publicKey) as JsonWebKey
    const clientPublicKeyBytes = new Uint8Array(65)
    clientPublicKeyBytes[0] = 0x04
    clientPublicKeyBytes.set(localB64urlDecode(clientPubJwk.x!), 1)
    clientPublicKeyBytes.set(localB64urlDecode(clientPubJwk.y!), 33)
    const clientPublicKeyB64 = localB64urlEncode(clientPublicKeyBytes)

    const authSecret = crypto.getRandomValues(new Uint8Array(16))
    const authSecretB64 = localB64urlEncode(authSecret)

    const plaintext = JSON.stringify({
      title: 'Campeche está ótima agora! 🏄',
      body: 'Score 8.7/10 · Toca ver as condições',
      url: 'https://www.surfaifloripa.com.br/spot/campeche',
    })

    const { body } = await mod.encryptWebPush(plaintext, clientPublicKeyB64, authSecretB64)

    const decrypted = await decryptAsClient(body, clientKp.privateKey, clientPublicKeyBytes, authSecret)
    expect(decrypted).toBe(plaintext)
  })

  it('duas chamadas com o mesmo plaintext produzem corpos diferentes (salt/chave efêmera não reaproveitados)', async () => {
    const clientKp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
    const clientPubJwk = await crypto.subtle.exportKey('jwk', clientKp.publicKey) as JsonWebKey
    const clientPublicKeyBytes = new Uint8Array(65)
    clientPublicKeyBytes[0] = 0x04
    clientPublicKeyBytes.set(localB64urlDecode(clientPubJwk.x!), 1)
    clientPublicKeyBytes.set(localB64urlDecode(clientPubJwk.y!), 33)
    const clientPublicKeyB64 = localB64urlEncode(clientPublicKeyBytes)
    const authSecretB64 = localB64urlEncode(crypto.getRandomValues(new Uint8Array(16)))

    const a = await mod.encryptWebPush('mesmo texto', clientPublicKeyB64, authSecretB64)
    const b = await mod.encryptWebPush('mesmo texto', clientPublicKeyB64, authSecretB64)
    expect(localB64urlEncode(a.body)).not.toBe(localB64urlEncode(b.body))
  })

  it('decifrar com o auth secret errado falha (autenticação AEAD real, não só formato)', async () => {
    const clientKp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
    const clientPubJwk = await crypto.subtle.exportKey('jwk', clientKp.publicKey) as JsonWebKey
    const clientPublicKeyBytes = new Uint8Array(65)
    clientPublicKeyBytes[0] = 0x04
    clientPublicKeyBytes.set(localB64urlDecode(clientPubJwk.x!), 1)
    clientPublicKeyBytes.set(localB64urlDecode(clientPubJwk.y!), 33)
    const clientPublicKeyB64 = localB64urlEncode(clientPublicKeyBytes)

    const realAuthSecret = crypto.getRandomValues(new Uint8Array(16))
    const wrongAuthSecret = crypto.getRandomValues(new Uint8Array(16))

    const { body } = await mod.encryptWebPush('segredo', clientPublicKeyB64, localB64urlEncode(realAuthSecret))

    await expect(
      decryptAsClient(body, clientKp.privateKey, clientPublicKeyBytes, wrongAuthSecret)
    ).rejects.toThrow()
  })
})
