// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { beachHeightFactor, toBeachHeight } from './_beachHeight'

describe('toBeachHeight', () => {
  it('30/set/2026: mar de 6 s, modelo 1,44 m no Campeche vira ~1 m (série que o usuário viu)', () => {
    expect(toBeachHeight(1.44, 6)).toBeCloseTo(1.01, 2)
  })

  it('24/set/2026: swell de 10-11 s fica do tamanho do modelo (o modelo acertou)', () => {
    expect(toBeachHeight(1.56, 10)).toBe(1.56)
    expect(toBeachHeight(1.56, 11)).toBe(1.56)
  })

  it('nunca aumenta a onda (preferência do usuário: mostrar mais baixo, nunca mais alto)', () => {
    for (let t = 0; t <= 20; t += 0.5) expect(beachHeightFactor(t)).toBeLessThanOrEqual(1)
  })

  it('período maior nunca dá onda menor', () => {
    let prev = 0
    for (let t = 3; t <= 16; t += 0.25) {
      const f = beachHeightFactor(t)
      expect(f).toBeGreaterThanOrEqual(prev)
      prev = f
    }
  })

  it('anda em linha reta entre os pontos e segura as pontas', () => {
    expect(beachHeightFactor(6.5)).toBeCloseTo(0.74, 5)
    expect(beachHeightFactor(3)).toBe(0.62)
    expect(beachHeightFactor(14)).toBe(1)
  })

  it('período ausente ou inválido não mexe na altura', () => {
    expect(toBeachHeight(1.2, NaN)).toBe(1.2)
    expect(toBeachHeight(1.2, 0)).toBe(1.2)
  })
})
