import { describe, it, expect } from 'vitest'
import { directionName, windEffect } from './directions'

describe('directionName', () => {
  it('traduz siglas principais e intermediárias', () => {
    expect(directionName('SE')).toBe('sudeste')
    expect(directionName('ESE')).toBe('entre leste e sudeste')
    expect(directionName('NNW')).toBe('entre norte e noroeste')
    expect(directionName('w')).toBe('oeste')
  })
  it('devolve a própria sigla se não reconhecer', () => {
    expect(directionName('XYZ')).toBe('XYZ')
  })
})

describe('windEffect', () => {
  // Praia virada pro leste (90°): terra fica a oeste
  it('vento de oeste numa praia virada pro leste é terral', () => {
    expect(windEffect('W', 90)).toBe('terral')
  })
  it('vento de leste numa praia virada pro leste é maral', () => {
    expect(windEffect('E', 90)).toBe('maral')
  })
  it('vento norte numa praia virada pro leste é lateral', () => {
    expect(windEffect('N', 90)).toBe('lateral')
  })
})
