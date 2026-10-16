// @vitest-environment node
//
// Testa a cascata de provedores do chat (Gemini -> Groq -> OpenRouter) sem gastar cota real
// de nenhuma API — mocka o fetch global e distingue qual provedor foi chamado pela URL.
// Ver comentário de `hasUsableText` em surf-chat.ts pro achado que motivou os casos de
// "resposta ok porém vazia" abaixo.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { callChatCascade } from './surf-chat'
import type { ChatTurn } from './_gemini'

const turns: ChatTurn[] = [{ role: 'user', text: 'como tá o Campeche?' }]

function mockFetchByProvider(handlers: {
  gemini?: { ok: boolean; status?: number; body: unknown }
  groq?: { ok: boolean; status?: number; body: unknown }
  openrouter?: { ok: boolean; status?: number; body: unknown }
}) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    const pick = url.includes('generativelanguage.googleapis.com') ? handlers.gemini
      : url.includes('api.groq.com') ? handlers.groq
      : url.includes('openrouter.ai') ? handlers.openrouter
      : undefined
    if (!pick) throw new Error(`fetch inesperado sem mock: ${url}`)
    return Promise.resolve({
      ok: pick.ok,
      status: pick.status ?? (pick.ok ? 200 : 500),
      json: () => Promise.resolve(pick.body),
      text: () => Promise.resolve(typeof pick.body === 'string' ? pick.body : JSON.stringify(pick.body)),
    })
  }))
}

const geminiOk = (text: string) => ({ ok: true, body: { candidates: [{ content: { parts: [{ text }] } }] } })
const geminiEmpty = { ok: true, body: { candidates: [] } } // bloqueio de safety: HTTP 200, sem candidato
const geminiFail = (status: number) => ({ ok: false, status, body: { error: { message: 'falhou' } } })

const openAiCompatOk = (text: string) => ({ ok: true, body: { choices: [{ message: { content: text } }] } })
const openAiCompatEmpty = { ok: true, body: { choices: [] } } // filtro de conteúdo: HTTP 200, sem choice
const openAiCompatFail = (status: number) => ({ ok: false, status, body: { error: { message: 'falhou' } } })

describe('callChatCascade', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'fake-gemini'
    process.env.GROQ_API_KEY = 'fake-groq'
    process.env.OPENROUTER_API_KEY = 'fake-openrouter'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  it('usa o Gemini quando ele responde normalmente (não chama Groq nem OpenRouter)', async () => {
    mockFetchByProvider({ gemini: geminiOk('Campeche tá bom hoje.') })
    const { result, provider } = await callChatCascade('sys', turns, 2000)
    expect(provider).toBe('gemini')
    expect(result).toEqual({ ok: true, text: 'Campeche tá bom hoje.' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('cai pro Groq quando o Gemini responde com erro HTTP (ex: cota estourada)', async () => {
    mockFetchByProvider({ gemini: geminiFail(429), groq: openAiCompatOk('resposta do Groq') })
    const { result, provider } = await callChatCascade('sys', turns, 2000)
    expect(provider).toBe('groq')
    expect(result).toEqual({ ok: true, text: 'resposta do Groq' })
  })

  it('cai pro Groq quando o Gemini volta HTTP 200 mas sem candidato (bloqueio de safety)', async () => {
    mockFetchByProvider({ gemini: geminiEmpty, groq: openAiCompatOk('resposta do Groq') })
    const { result, provider } = await callChatCascade('sys', turns, 2000)
    expect(provider).toBe('groq')
    expect(result).toEqual({ ok: true, text: 'resposta do Groq' })
  })

  it('cai pro OpenRouter quando Gemini e Groq falham', async () => {
    mockFetchByProvider({
      gemini: geminiFail(500),
      groq: openAiCompatFail(503),
      openrouter: openAiCompatOk('resposta do OpenRouter'),
    })
    const { result, provider } = await callChatCascade('sys', turns, 2000)
    expect(provider).toBe('openrouter')
    expect(result).toEqual({ ok: true, text: 'resposta do OpenRouter' })
  })

  it('cai pro OpenRouter quando Groq volta 200 com choices vazio (filtro de conteúdo)', async () => {
    mockFetchByProvider({
      gemini: geminiFail(500),
      groq: openAiCompatEmpty,
      openrouter: openAiCompatOk('resposta do OpenRouter'),
    })
    const { result, provider } = await callChatCascade('sys', turns, 2000)
    expect(provider).toBe('openrouter')
    expect(result).toEqual({ ok: true, text: 'resposta do OpenRouter' })
  })

  it('retorna falha clara quando os três provedores falham', async () => {
    mockFetchByProvider({
      gemini: geminiFail(500),
      groq: openAiCompatFail(500),
      openrouter: openAiCompatFail(500),
    })
    const { result, provider } = await callChatCascade('sys', turns, 2000)
    expect(provider).toBe('none')
    expect(result.ok).toBe(false)
  })

  it('retorna falha clara quando os três provedores voltam vazios (nenhum HTTP erro)', async () => {
    mockFetchByProvider({ gemini: geminiEmpty, groq: openAiCompatEmpty, openrouter: openAiCompatEmpty })
    const { result, provider } = await callChatCascade('sys', turns, 2000)
    expect(provider).toBe('none')
    expect(result.ok).toBe(false)
  })

  it('pula o Gemini direto pro Groq quando GEMINI_API_KEY não está configurada', async () => {
    delete process.env.GEMINI_API_KEY
    mockFetchByProvider({ groq: openAiCompatOk('resposta do Groq') })
    const { result, provider } = await callChatCascade('sys', turns, 2000)
    expect(provider).toBe('groq')
    expect(result).toEqual({ ok: true, text: 'resposta do Groq' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('não chama nenhum provedor e falha rápido quando nenhuma key está configurada', async () => {
    delete process.env.GEMINI_API_KEY
    delete process.env.GROQ_API_KEY
    delete process.env.OPENROUTER_API_KEY
    vi.stubGlobal('fetch', vi.fn())
    const { result, provider } = await callChatCascade('sys', turns, 2000)
    expect(provider).toBe('none')
    expect(result.ok).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
})
