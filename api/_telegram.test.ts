// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { toTelegramHtml, sendTelegram } from './_telegram'

describe('toTelegramHtml', () => {
  it('troca *negrito* do WhatsApp por <b> e escapa o que o HTML do Telegram não aceita', () => {
    expect(toTelegramHtml('🏄 *Surf AI · Relatório Noite · 13/10*')).toBe('🏄 <b>Surf AI · Relatório Noite · 13/10</b>')
    expect(toTelegramHtml('Receita < R$ 10 & conversão > 0%')).toBe('Receita &lt; R$ 10 &amp; conversão &gt; 0%')
  })
  it('asterisco sozinho fica como está', () => {
    expect(toTelegramHtml('nota 7* (estimada)')).toBe('nota 7* (estimada)')
  })
})

describe('sendTelegram', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('manda pro chat certo em HTML', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') })
    vi.stubGlobal('fetch', fetchMock)
    expect(await sendTelegram('123:abc', '999', '*Análise do dia*\n\nTexto.')).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.telegram.org/bot123:abc/sendMessage')
    expect(JSON.parse(init.body)).toMatchObject({ chat_id: '999', parse_mode: 'HTML', text: '<b>Análise do dia</b>\n\nTexto.' })
  })

  it('recusa do Telegram (ex.: bot nunca iniciado, 403) devolve false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, text: () => Promise.resolve('Forbidden: bot can\'t initiate conversation with a user') }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await sendTelegram('123:abc', '999', 'oi')).toBe(false)
  })
})
