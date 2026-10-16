// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { splitForWhatsApp, sendWhatsApp, WHATSAPP_MAX_CHARS } from './_callmebot'

describe('splitForWhatsApp', () => {
  it('mensagem curta vai inteira', () => {
    expect(splitForWhatsApp('Bom dia!\n\nUsuários: 21')).toEqual(['Bom dia!\n\nUsuários: 21'])
  })

  it('quebra entre parágrafos sem passar do limite', () => {
    const p = 'x'.repeat(250)
    const chunks = splitForWhatsApp([p, p, p].join('\n\n'))
    expect(chunks).toEqual([`${p}\n\n${p}`, p])
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(WHATSAPP_MAX_CHARS)
  })

  it('parágrafo maior que o limite é quebrado num espaço, sem perder texto', () => {
    const words = Array.from({ length: 200 }, (_, i) => `palavra${i}`)
    const chunks = splitForWhatsApp(words.join(' '))
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(WHATSAPP_MAX_CHARS)
    expect(chunks.join(' ').split(' ')).toEqual(words)
  })

  it('relatório do dia 07/out (1.030 caracteres, cortado no 718) sai em pedaços dentro do limite', () => {
    const numbers = 'Usuários: 21 (+0 hoje)\nPremium pago: 0 (+0 hoje)\nCortesia: 1\n'.repeat(5)
    const ai = 'O ponto positivo do período é a ausência de cancelamentos. '.repeat(10)
    const chunks = splitForWhatsApp(`${numbers}\n\n${ai}`)
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(WHATSAPP_MAX_CHARS)
    expect(chunks[0]).toBe(numbers.trimEnd())
  })
})

describe('sendWhatsApp', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('manda cada pedaço em ordem e só dá certo se todos saírem', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue(new Response('Message queued'))
    vi.stubGlobal('fetch', fetchMock)
    const p = 'y'.repeat(400)
    const sending = sendWhatsApp('5548999999999', '123456', `${p}\n\n${p}`)
    await vi.runAllTimersAsync()
    expect(await sending).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toContain(`text=${p}`)
  })

  it('para no primeiro pedaço que falhar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn().mockResolvedValue(new Response('APIKey is invalid', { status: 403 }))
    vi.stubGlobal('fetch', fetchMock)
    const p = 'z'.repeat(400)
    expect(await sendWhatsApp('5548999999999', '123456', `${p}\n\n${p}`)).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
