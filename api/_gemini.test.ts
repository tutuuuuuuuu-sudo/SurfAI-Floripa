// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { callGemini, callGeminiChat, GEMINI_RETRY_PAUSE_MS } from './_gemini'

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

// 13/out/2026: o relatório da noite saiu sem a análise porque o Gemini respondeu 503 ("This
// model is currently experiencing high demand") e o código desistia na primeira resposta
describe('nova tentativa quando o Google está sobrecarregado', () => {
  const overloaded = { ok: false, status: 503, json: () => Promise.resolve({}), text: () => Promise.resolve('{"error":{"code":503,"status":"UNAVAILABLE"}}') }
  const answer = { ok: true, status: 200, json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: 'Análise.' }] } }] }), text: () => Promise.resolve('') }

  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

  async function run<T>(call: () => Promise<T>): Promise<T> {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const promise = call()
    await vi.advanceTimersByTimeAsync(GEMINI_RETRY_PAUSE_MS)
    return promise
  }

  it('503 e depois resposta: tenta de novo e devolve o texto', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(overloaded).mockResolvedValueOnce(answer)
    vi.stubGlobal('fetch', fetchMock)
    const result = await run(() => callGemini('fake-key', 'prompt', 300, 15000))
    expect(result).toEqual({ ok: true, text: 'Análise.' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('o chat também tenta de novo', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ...overloaded, status: 500 }).mockResolvedValueOnce(answer)
    vi.stubGlobal('fetch', fetchMock)
    const result = await run(() => callGeminiChat('fake-key', 'contexto', [{ role: 'user', text: 'oi' }], 300, 9000))
    expect(result).toEqual({ ok: true, text: 'Análise.' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('tenta só uma vez a mais: dois 503 seguidos devolvem o erro', async () => {
    const fetchMock = vi.fn().mockResolvedValue(overloaded)
    vi.stubGlobal('fetch', fetchMock)
    const result = await run(() => callGemini('fake-key', 'prompt', 300, 15000))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(503)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('cota estourada (429) não tenta de novo', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ...overloaded, status: 429 })
    vi.stubGlobal('fetch', fetchMock)
    const result = await callGemini('fake-key', 'prompt', 300, 15000)
    expect(result.ok).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sem tempo sobrando, não tenta de novo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(overloaded)
    vi.stubGlobal('fetch', fetchMock)
    const result = await callGemini('fake-key', 'prompt', 300, 3000)
    expect(result.ok).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
