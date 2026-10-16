import { describe, it, expect } from 'vitest'
import { applyPremiumLock, FREE_DAYS, type WeatherForecast } from './weatherData'

function makeDays(n: number): WeatherForecast[] {
  return Array.from({ length: n }, (_, i) => ({
    date: `2026-06-0${i + 1}`,
    dayName: `dia${i + 1}`,
    waveHeight: 1.2,
    windSpeed: 10,
    windDirection: 'E',
    swellPeriod: 10,
    temperature: 24,
    condition: 'Bom' as const,
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

  it('com exatamente FREE_DAYS dias, free não bloqueia nenhum', () => {
    const result = applyPremiumLock(makeDays(FREE_DAYS), false)
    expect(result.every(d => !d.locked)).toBe(true)
  })

  it('com um dia a mais que FREE_DAYS, free bloqueia só o último', () => {
    const result = applyPremiumLock(makeDays(FREE_DAYS + 1), false)
    expect(result[FREE_DAYS].locked).toBe(true)
    expect(result.filter(d => d.locked)).toHaveLength(1)
  })
})
