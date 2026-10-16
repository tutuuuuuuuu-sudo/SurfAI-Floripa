import { describe, it, expect } from 'vitest'
import { PRICE_MONTHLY, PRICE_ANNUAL, PRICE_ANNUAL_PER_MONTH, ANNUAL_SAVINGS, formatBRL, perDayCeil } from './pricing'

describe('pricing', () => {
  it('anual cobrado é 12x o valor por mês anunciado', () => {
    expect(Math.round(PRICE_ANNUAL_PER_MONTH * 12 * 100)).toBe(Math.round(PRICE_ANNUAL * 100))
  })

  it('formata em reais com vírgula', () => {
    expect(formatBRL(PRICE_MONTHLY)).toBe('R$ 22,90')
    expect(formatBRL(PRICE_ANNUAL)).toBe('R$ 202,80')
    expect(formatBRL(PRICE_ANNUAL_PER_MONTH)).toBe('R$ 16,90')
  })

  it('economia do anual não perde 1 real no ponto flutuante', () => {
    expect(ANNUAL_SAVINGS).toBe(72)
  })

  it('"menos de X por dia" é sempre verdade', () => {
    expect(perDayCeil(PRICE_ANNUAL, 365)).toBe('R$ 0,56')
    expect(PRICE_ANNUAL / 365).toBeLessThan(0.56)
    expect(perDayCeil(PRICE_MONTHLY, 30)).toBe('R$ 0,77')
    expect(PRICE_MONTHLY / 30).toBeLessThan(0.77)
  })
})
