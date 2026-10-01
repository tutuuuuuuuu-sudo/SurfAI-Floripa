// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { beachHeightFactor, longPeriodBoost, toBeachHeight } from './_beachHeight'

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

describe('toBeachHeight — base no modelo francês (01/out/2026)', () => {
  it('01/out 6h30, boletim.surf 0,5-0,6 m: Morro das Pedras e Armação ficam em ~0,7 (antes 1,17 e 0,94)', () => {
    expect(toBeachHeight(1.5, 7, 0.7)).toBe(0.7)
    expect(toBeachHeight(1.2, 7, 0.7)).toBe(0.7)
  })

  it('30/set ~11h, usuário viu série de 1 m no Campeche: segue ~1 m', () => {
    expect(toBeachHeight(1.48, 6, 1.04)).toBeCloseTo(1.04, 2)
  })

  it('24/set, ondulação longa (séries ~2 m): francês 1,02 ganha acréscimo de onda longa', () => {
    const h = toBeachHeight(1.58, 9.5, 1.02)
    expect(h).toBeGreaterThan(1.2)
    expect(h).toBeLessThanOrEqual(1.58)
  })

  it('acréscimo de onda longa: nada até 8 s, +30% a partir de 10 s', () => {
    expect(longPeriodBoost(7)).toBe(1)
    expect(longPeriodBoost(9)).toBeCloseTo(1.15, 5)
    expect(longPeriodBoost(12)).toBeCloseTo(1.3, 5)
  })

  it('nunca passa da conta antiga do mar aberto (teto)', () => {
    expect(toBeachHeight(1.0, 6, 2.0)).toBeCloseTo(0.7, 2)
  })

  it('só com o francês (sem mar aberto) usa francês × acréscimo; sem nenhum, 0', () => {
    expect(toBeachHeight(null, 10, 1.0)).toBeCloseTo(1.3, 5)
    expect(toBeachHeight(null, 6, null)).toBe(0)
  })
})
