// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isSchedulerCall } from './_auth'

const SECRET = 'senha-do-agendador-com-mais-de-20'

function schedulerRequest(secret: string | null = SECRET) {
  return new Request('https://www.surfaifloripa.com.br/api/snapshot', {
    headers: secret === null ? {} : { 'x-cron-secret': secret },
  })
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('isSchedulerCall', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://exemplo.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'chave-de-servico')
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('aceita quando o banco confirma a senha', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(true))
    vi.stubGlobal('fetch', fetchMock)
    expect(await isSchedulerCall(schedulerRequest())).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('tenta de novo quando a conferência falha por rede e aceita na segunda', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse(true))
    vi.stubGlobal('fetch', fetchMock)
    expect(await isSchedulerCall(schedulerRequest())).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('tenta de novo quando o banco responde com erro e registra o motivo', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('upstream timeout', { status: 504 }))
      .mockResolvedValueOnce(jsonResponse(true))
    vi.stubGlobal('fetch', fetchMock)
    expect(await isSchedulerCall(schedulerRequest())).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('voltou 504'), 'upstream timeout')
  })

  it('desiste depois de duas falhas', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    vi.stubGlobal('fetch', fetchMock)
    expect(await isSchedulerCall(schedulerRequest())).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('senha errada não repete a conferência', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(false))
    vi.stubGlobal('fetch', fetchMock)
    expect(await isSchedulerCall(schedulerRequest())).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sem a senha no cabeçalho nem consulta o banco', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await isSchedulerCall(schedulerRequest(null))).toBe(false)
    expect(await isSchedulerCall(schedulerRequest('curta'))).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
