// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { verifyMpSignature } from './_mpAuth'

const SECRET = 'test-secret-abc123'

async function sign(manifest: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

async function buildXSignature(dataId: string, requestId: string, ts: string, secret: string): Promise<string> {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
  const hash = await sign(manifest, secret)
  return `ts=${ts},v1=${hash}`
}

describe('verifyMpSignature', () => {
  it('aceita assinatura válida com os mesmos dataId/requestId/ts usados no manifest', async () => {
    const xSignature = await buildXSignature('123456789', 'req-abc', '1699999999', SECRET)
    const valid = await verifyMpSignature(xSignature, 'req-abc', '123456789', SECRET)
    expect(valid).toBe(true)
  })

  it('rejeita quando o secret usado na verificação é diferente do usado na assinatura', async () => {
    const xSignature = await buildXSignature('123456789', 'req-abc', '1699999999', SECRET)
    const valid = await verifyMpSignature(xSignature, 'req-abc', '123456789', 'wrong-secret')
    expect(valid).toBe(false)
  })

  it('rejeita quando o dataId foi alterado após a assinatura (payload tampering)', async () => {
    const xSignature = await buildXSignature('123456789', 'req-abc', '1699999999', SECRET)
    const valid = await verifyMpSignature(xSignature, 'req-abc', '999999999', SECRET)
    expect(valid).toBe(false)
  })

  it('rejeita quando o requestId foi alterado após a assinatura', async () => {
    const xSignature = await buildXSignature('123456789', 'req-abc', '1699999999', SECRET)
    const valid = await verifyMpSignature(xSignature, 'req-outro', '123456789', SECRET)
    expect(valid).toBe(false)
  })

  it('rejeita header x-signature ausente', async () => {
    const valid = await verifyMpSignature(null, 'req-abc', '123456789', SECRET)
    expect(valid).toBe(false)
  })

  it('rejeita x-signature sem o campo v1', async () => {
    const valid = await verifyMpSignature('ts=1699999999', 'req-abc', '123456789', SECRET)
    expect(valid).toBe(false)
  })

  it('rejeita x-signature sem o campo ts', async () => {
    const valid = await verifyMpSignature('v1=aabbcc', 'req-abc', '123456789', SECRET)
    expect(valid).toBe(false)
  })

  it('rejeita v1 com hex malformado sem lançar exceção', async () => {
    const valid = await verifyMpSignature('ts=1699999999,v1=zznotahex!!', 'req-abc', '123456789', SECRET)
    expect(valid).toBe(false)
  })

  it('rejeita v1 com comprimento de hex ímpar sem lançar exceção', async () => {
    const valid = await verifyMpSignature('ts=1699999999,v1=abc', 'req-abc', '123456789', SECRET)
    expect(valid).toBe(false)
  })

  it('trata dataId e requestId ausentes (null) da mesma forma que string vazia na assinatura', async () => {
    const xSignature = await buildXSignature('', '', '1699999999', SECRET)
    const valid = await verifyMpSignature(xSignature, null, null, SECRET)
    expect(valid).toBe(true)
  })

  it('rejeita assinatura de tamanho de hash incompatível com HMAC-SHA256 (32 bytes)', async () => {
    const shortHash = 'aabbcc' // 3 bytes, não 32
    const valid = await verifyMpSignature(`ts=1699999999,v1=${shortHash}`, 'req-abc', '123456789', SECRET)
    expect(valid).toBe(false)
  })

  it('produz assinaturas diferentes para dataId diferentes (sanity check do helper de teste)', async () => {
    const sigA = await buildXSignature('111', 'req-abc', '1699999999', SECRET)
    const sigB = await buildXSignature('222', 'req-abc', '1699999999', SECRET)
    expect(sigA).not.toBe(sigB)
  })
})
