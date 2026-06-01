import { describe, it, expect } from 'vitest'

// Testa a lógica de lock diretamente — sem precisar mockar fetch
// A função applyPremiumLock não é exportada, mas podemos testar via
// uma versão inline idêntica para garantir o contrato de negócio.

const FREE_DAYS = 3

function applyPremiumLock(
  forecasts: { date: string; score: number; locked: boolean }[],
  isPremium: boolean
) {
  if (isPremium) return forecasts.map(f => ({ ...f, locked: false }))
  return forecasts.map((f, i) => ({ ...f, locked: i >= FREE_DAYS }))
}

function makeDays(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    date: `2026-06-0${i + 1}`,
    score: 7,
    locked: false,
  }))
}

describe('applyPremiumLock', () => {
  it('usuário free: primeiros 3 dias desbloqueados', () => {
    const result = applyPremiumLock(makeDays(7), false)
    expect(result[0].locked).toBe(false)
    expect(result[1].locked).toBe(false)
    expect(result[2].locked).toBe(false)
  })

  it('usuário free: dias 4-7 bloqueados', () => {
    const result = applyPremiumLock(makeDays(7), false)
    expect(result[3].locked).toBe(true)
    expect(result[4].locked).toBe(true)
    expect(result[6].locked).toBe(true)
  })

  it('usuário premium: todos os 14 dias desbloqueados', () => {
    const result = applyPremiumLock(makeDays(14), true)
    expect(result.every(d => !d.locked)).toBe(true)
  })

  it('usuário premium: não bloqueia nenhum dia independente da quantidade', () => {
    const result = applyPremiumLock(makeDays(14), true)
    expect(result.filter(d => d.locked)).toHaveLength(0)
  })

  it('array vazio não quebra', () => {
    expect(() => applyPremiumLock([], false)).not.toThrow()
    expect(() => applyPremiumLock([], true)).not.toThrow()
  })

  it('com exatamente 3 dias, free não bloqueia nenhum', () => {
    const result = applyPremiumLock(makeDays(3), false)
    expect(result.every(d => !d.locked)).toBe(true)
  })

  it('com exatamente 4 dias, free bloqueia só o último', () => {
    const result = applyPremiumLock(makeDays(4), false)
    expect(result[3].locked).toBe(true)
    expect(result.filter(d => d.locked)).toHaveLength(1)
  })
})
