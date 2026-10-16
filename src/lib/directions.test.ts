import { describe, it, expect } from 'vitest'
import { directionName } from './directions'

describe('directionName', () => {
  it('traduz siglas principais e intermediárias', () => {
    expect(directionName('SE')).toBe('sudeste')
    expect(directionName('ESE')).toBe('leste sudeste')
    expect(directionName('NNW')).toBe('norte noroeste')
    expect(directionName('w')).toBe('oeste')
  })
  it('devolve a própria sigla se não reconhecer', () => {
    expect(directionName('XYZ')).toBe('XYZ')
  })
})
