// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { maybeSingleMock, upsertMock, fromMock } = vi.hoisted(() => {
  const maybeSingleMock = vi.fn()
  const upsertMock = vi.fn().mockResolvedValue({ error: null })
  const fromMock = vi.fn(() => ({
    select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
    upsert: upsertMock,
  }))
  return { maybeSingleMock, upsertMock, fromMock }
})

vi.mock('./supabase', () => ({ supabase: { from: fromMock } }))

describe('onboarding', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    maybeSingleMock.mockReset()
    upsertMock.mockClear()
    fromMock.mockClear()
  })

  it('localStorage funcionando: isOnboardingDone reflete markOnboardingDone', async () => {
    const { isOnboardingDone, markOnboardingDone } = await import('./onboarding')
    expect(isOnboardingDone()).toBe(false)
    markOnboardingDone()
    expect(isOnboardingDone()).toBe(true)
    expect(localStorage.getItem('onboarding_done')).toBe('1')
  })

  it('localStorage bloqueado: markOnboardingDone cai no fallback em memória e isOnboardingDone continua true na mesma sessão', async () => {
    const { isOnboardingDone, markOnboardingDone } = await import('./onboarding')
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    expect(() => markOnboardingDone()).not.toThrow()
    expect(isOnboardingDone()).toBe(true)

    setItemSpy.mockRestore()
    getItemSpy.mockRestore()
  })

  it('sem chamar markOnboardingDone, isOnboardingDone é false mesmo com localStorage acessível', async () => {
    const { isOnboardingDone } = await import('./onboarding')
    expect(isOnboardingDone()).toBe(false)
  })

  it('markOnboardingDoneRemote grava onboarding_done_at pro user_id no Supabase', async () => {
    const { markOnboardingDoneRemote } = await import('./onboarding')
    markOnboardingDoneRemote('user-123')
    expect(fromMock).toHaveBeenCalledWith('user_preferences')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-123', onboarding_done_at: expect.any(String) }),
      { onConflict: 'user_id' }
    )
  })

  it('syncOnboardingDoneFromServer marca local e retorna true quando já feito em outro dispositivo', async () => {
    maybeSingleMock.mockResolvedValue({ data: { onboarding_done_at: '2026-09-23T00:00:00.000Z' } })
    const { syncOnboardingDoneFromServer, isOnboardingDone } = await import('./onboarding')
    expect(isOnboardingDone()).toBe(false)
    const done = await syncOnboardingDoneFromServer('user-123')
    expect(done).toBe(true)
    expect(isOnboardingDone()).toBe(true)
  })

  it('syncOnboardingDoneFromServer retorna false quando não há registro remoto', async () => {
    maybeSingleMock.mockResolvedValue({ data: null })
    const { syncOnboardingDoneFromServer, isOnboardingDone } = await import('./onboarding')
    const done = await syncOnboardingDoneFromServer('user-123')
    expect(done).toBe(false)
    expect(isOnboardingDone()).toBe(false)
  })

  it('syncOnboardingDoneFromServer não lança se a rede falhar', async () => {
    maybeSingleMock.mockRejectedValue(new Error('network error'))
    const { syncOnboardingDoneFromServer } = await import('./onboarding')
    await expect(syncOnboardingDoneFromServer('user-123')).resolves.toBe(false)
  })
})
