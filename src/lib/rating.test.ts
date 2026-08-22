import { describe, it, expect } from 'vitest'
import { getRatingInfo, getScoreColor, getThemeGradient } from './rating'

describe('getRatingInfo', () => {
  it('score 10 → ÉPICO', () => expect(getRatingInfo(10).label).toBe('ÉPICO'))
  it('score 8.5 → ÉPICO', () => expect(getRatingInfo(8.5).label).toBe('ÉPICO'))
  it('score 8.4 → EXCELENTE', () => expect(getRatingInfo(8.4).label).toBe('EXCELENTE'))
  it('score 7.0 → EXCELENTE', () => expect(getRatingInfo(7).label).toBe('EXCELENTE'))
  it('score 6.9 → BOM', () => expect(getRatingInfo(6.9).label).toBe('BOM'))
  it('score 5.5 → BOM', () => expect(getRatingInfo(5.5).label).toBe('BOM'))
  it('score 5.4 → REGULAR', () => expect(getRatingInfo(5.4).label).toBe('REGULAR'))
  it('score 4.0 → REGULAR', () => expect(getRatingInfo(4).label).toBe('REGULAR'))
  it('score 3.9 → RUIM', () => expect(getRatingInfo(3.9).label).toBe('RUIM'))
  it('score 1.0 → RUIM', () => expect(getRatingInfo(1).label).toBe('RUIM'))
  it('score 0 → RUIM', () => expect(getRatingInfo(0).label).toBe('RUIM'))

  it('ÉPICO tem 5 barras', () => expect(getRatingInfo(9).bars).toBe(5))
  it('EXCELENTE tem 4 barras', () => expect(getRatingInfo(7.5).bars).toBe(4))
  it('BOM tem 3 barras', () => expect(getRatingInfo(6).bars).toBe(3))
  it('REGULAR tem 2 barras', () => expect(getRatingInfo(4.5).bars).toBe(2))
  it('RUIM tem 1 barra', () => expect(getRatingInfo(2).bars).toBe(1))

  it('sempre retorna color, bg e scoreColor preenchidos', () => {
    [0, 3, 5.5, 7, 8.5, 10].forEach(score => {
      const info = getRatingInfo(score)
      expect(info.color).toBeTruthy()
      expect(info.bg).toBeTruthy()
      expect(info.scoreColor).toBeTruthy()
    })
  })
})

describe('getScoreColor', () => {
  it('retorna string de cor para qualquer score', () => {
    [0, 5, 8.5, 10].forEach(s => expect(typeof getScoreColor(s)).toBe('string'))
  })
})

describe('getThemeGradient', () => {
  it('retorna string de gradiente Tailwind para qualquer score', () => {
    [0, 4, 5.5, 7, 8.5].forEach(s => {
      const g = getThemeGradient(s)
      expect(g).toContain('from-')
    })
  })
})
