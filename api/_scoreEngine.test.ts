// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { calculateSurfScore, applyDirectionalExposure, explainSurfScore } from './_scoreEngine'

describe('explainSurfScore', () => {
  it('a soma dos três componentes bate exatamente com calculateSurfScore (mesmos inputs)', () => {
    const cases: [number, number, number, string, number][] = [
      [2.5, 5, 16, 'W', 90],
      [1.0, 12, 9, 'S', 90],
      [0.4, 21, 7, 'SSE', 90],
      [0.7, 24, 7, 'S', 180],
    ]
    for (const args of cases) {
      const total = calculateSurfScore(...args)
      const breakdown = explainSurfScore(...args)
      expect(breakdown.total).toBe(total)
      const sum = Number((breakdown.waveBase + breakdown.windPenalty + breakdown.periodAdjust).toFixed(1))
      // Só diverge da soma bruta quando o clamp [1,10] do calculateSurfScore entra em ação
      const clamped = Math.min(10, Math.max(1, sum))
      expect(breakdown.total).toBe(clamped)
    }
  })

  it('classifica o vento como offshore/lateral/onshore de acordo com o ângulo até a praia', () => {
    // Praia orientação 90° (leste) — offshore é vento W (270°)
    expect(explainSurfScore(1, 5, 10, 'W', 90).windQuality).toBe('offshore')
    expect(explainSurfScore(1, 5, 10, 'N', 90).windQuality).toBe('lateral')
    expect(explainSurfScore(1, 5, 10, 'E', 90).windQuality).toBe('onshore')
  })
})

describe('calculateSurfScore', () => {
  // ── Limites absolutos ────────────────────────────────────────────────────────

  it('nunca retorna score abaixo de 1', () => {
    const score = calculateSurfScore(0, 50, 1, 'E', 90)
    expect(score).toBeGreaterThanOrEqual(1)
  })

  it('nunca retorna score acima de 10', () => {
    const score = calculateSurfScore(3, 0, 20, 'W', 90)
    expect(score).toBeLessThanOrEqual(10)
  })

  // ── Altura de onda ───────────────────────────────────────────────────────────

  it('ondas 2.5m+ com condições ideais retorna 10', () => {
    // Praia orientação 90° (leste), vento W (offshore), vento leve, período longo
    const score = calculateSurfScore(2.5, 5, 16, 'W', 90)
    expect(score).toBe(10)
  })

  it('ondas 1.0m retorna base 8.0 com condições neutras', () => {
    // Período 10s (neutro), vento offshore leve
    const score = calculateSurfScore(1.0, 5, 10, 'W', 90)
    expect(score).toBe(8)
  })

  it('ondas muito pequenas (0.3m) penaliza bastante', () => {
    const score = calculateSurfScore(0.3, 5, 10, 'W', 90)
    expect(score).toBeLessThan(5)
  })

  // ── Vento offshore / onshore ─────────────────────────────────────────────────

  it('vento offshore leve não penaliza', () => {
    // Praia leste (90°), offshore é W (270°)
    const scoreOffshore = calculateSurfScore(1.0, 8, 10, 'W', 90)
    const scoreOnshore  = calculateSurfScore(1.0, 8, 10, 'E', 90)
    expect(scoreOffshore).toBeGreaterThan(scoreOnshore)
  })

  it('vento onshore forte penaliza fortemente', () => {
    const scoreLight  = calculateSurfScore(1.0, 5,  10, 'E', 90)
    const scoreStrong = calculateSurfScore(1.0, 30, 10, 'E', 90)
    expect(scoreStrong).toBeLessThan(scoreLight)
  })

  it('offshore leve é melhor que offshore forte', () => {
    const offshoreLight  = calculateSurfScore(1.0, 5,  10, 'W', 90)
    const offshoreStrong = calculateSurfScore(1.0, 25, 10, 'W', 90)
    expect(offshoreLight).toBeGreaterThan(offshoreStrong)
  })

  it('offshore a qualquer intensidade é melhor que onshore à mesma intensidade', () => {
    const offshore = calculateSurfScore(1.0, 15, 10, 'W', 90)
    const onshore  = calculateSurfScore(1.0, 15, 10, 'E', 90)
    expect(offshore).toBeGreaterThan(onshore)
  })

  // ── Período do swell ─────────────────────────────────────────────────────────

  it('período longo (16s+) adiciona bônus', () => {
    const long  = calculateSurfScore(1.0, 5, 16, 'W', 90)
    const short = calculateSurfScore(1.0, 5, 6,  'W', 90)
    expect(long).toBeGreaterThan(short)
  })

  it('período muito curto (5s) penaliza', () => {
    const medium = calculateSurfScore(1.0, 5, 10, 'W', 90)
    const short  = calculateSurfScore(1.0, 5, 5,  'W', 90)
    expect(short).toBeLessThan(medium)
  })

  // ── Direção desconhecida ─────────────────────────────────────────────────────

  it('direção de vento desconhecida não causa crash', () => {
    expect(() => calculateSurfScore(1.0, 10, 10, 'DESCONHECIDO', 90)).not.toThrow()
  })

  // ── Orientações de praia ─────────────────────────────────────────────────────

  it('mesmo vento é offshore para praia leste e onshore para praia oeste', () => {
    // Vento E: offshore para praia W (270°), onshore para praia E (90°)
    const asOffshore = calculateSurfScore(1.0, 15, 10, 'E', 270)
    const asOnshore  = calculateSurfScore(1.0, 15, 10, 'E', 90)
    expect(asOffshore).toBeGreaterThan(asOnshore)
  })
})

describe('applyDirectionalExposure', () => {
  it('swell alinhado com a praia não reduz a altura', () => {
    // Praia orientação 90° (leste), swell vindo de E (90°) — bate de frente
    const result = applyDirectionalExposure(1.0, 'E', 90)
    expect(result).toBe(1.0)
  })

  it('swell perpendicular à praia reduz bastante a altura', () => {
    // Praia orientação 90° (leste), swell vindo de N (0°) — bate de lado
    const result = applyDirectionalExposure(1.0, 'N', 90)
    expect(result).toBeLessThan(1.0)
  })

  it('nunca reduz abaixo do piso de 55%', () => {
    // Swell vindo de trás da praia (180° de diferença) — pior caso possível
    const result = applyDirectionalExposure(1.0, 'W', 90)
    expect(result).toBeGreaterThanOrEqual(0.55)
  })

  it('quanto maior o desalinhamento, maior a redução', () => {
    const aligned  = applyDirectionalExposure(1.0, 'E', 90)
    const oblique  = applyDirectionalExposure(1.0, 'SE', 90)
    const sideways = applyDirectionalExposure(1.0, 'N', 90)
    expect(aligned).toBeGreaterThan(oblique)
    expect(oblique).toBeGreaterThan(sideways)
  })

  it('direção de swell desconhecida retorna a altura original', () => {
    const result = applyDirectionalExposure(1.0, 'DESCONHECIDO', 90)
    expect(result).toBe(1.0)
  })
})
