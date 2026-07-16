// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('onboarding', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
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
})
