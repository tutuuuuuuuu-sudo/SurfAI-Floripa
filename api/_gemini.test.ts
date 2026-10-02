// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { callGemini } from './_gemini'

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok, status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  }))
}

describe('callGemini', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('pula partes marcadas como thought e usa a resposta final', async () => {
    mockFetchOnce({
      candidates: [{ content: { parts: [
        { text: 'raciocinando sobre o prompt...', thought: true },
        { text: 'Aqui está o relatório de verdade.' },
      ] } }],
    })
    const result = await callGemini('fake-key', 'prompt', 300)
    expect(result).toEqual({ ok: true, text: 'Aqui está o relatório de verdade.' })
  })

  it('usa a primeira parte quando não há nenhuma marcada como thought (modelo sem raciocínio)', async () => {
    mockFetchOnce({ candidates: [{ content: { parts: [{ text: 'Resposta direta.' }] } }] })
    const result = await callGemini('fake-key', 'prompt', 300)
    expect(result).toEqual({ ok: true, text: 'Resposta direta.' })
  })

  it('retorna erro quando a resposta HTTP não é ok', async () => {
    mockFetchOnce({ error: { message: 'quota exceeded' } }, false, 429)
    const result = await callGemini('fake-key', 'prompt', 300)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(429)
  })

  it('retorna texto vazio (não quebra) quando não há candidates', async () => {
    mockFetchOnce({})
    const result = await callGemini('fake-key', 'prompt', 300)
    expect(result).toEqual({ ok: true, text: '' })
  })
})
