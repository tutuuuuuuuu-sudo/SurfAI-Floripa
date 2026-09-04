import { describe, it, expect } from 'vitest'
import { degreesToWindDir, WIND_DEG } from './surfData'

describe('degreesToWindDir', () => {
  it('0° = N', () => expect(degreesToWindDir(0)).toBe('N'))
  it('90° = E', () => expect(degreesToWindDir(90)).toBe('E'))
  it('180° = S', () => expect(degreesToWindDir(180)).toBe('S'))
  it('270° = W', () => expect(degreesToWindDir(270)).toBe('W'))
  it('45° = NE', () => expect(degreesToWindDir(45)).toBe('NE'))
  it('135° = SE', () => expect(degreesToWindDir(135)).toBe('SE'))
  it('315° = NW', () => expect(degreesToWindDir(315)).toBe('NW'))
  it('360° normaliza para N', () => expect(degreesToWindDir(360)).toBe('N'))
  it('valores intermediários arredondam corretamente (22° → NNE)', () => {
    expect(degreesToWindDir(22)).toBe('NNE')
  })
})

describe('WIND_DEG map', () => {
  it('tem todas as 16 direções', () => {
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
    dirs.forEach(d => expect(WIND_DEG[d]).toBeDefined())
  })

  it('graus são consistentes com degreesToWindDir (ida e volta)', () => {
    // Para cada direção no mapa, converter graus de volta deve dar a mesma direção
    const dirs = ['N','NE','E','SE','S','SW','W','NW'] as const
    dirs.forEach(d => {
      expect(degreesToWindDir(WIND_DEG[d])).toBe(d)
    })
  })
})
