import { describe, it, expect } from 'vitest'
import { computeTrend } from './compareTrend'

describe('computeTrend', () => {
  it('sobe quando a nota daqui a 3h é pelo menos 0.5 maior', () => {
    const slots = [{ hour: 10, score: 5 }, { hour: 13, score: 6 }]
    expect(computeTrend(slots, 10)).toBe('up')
  })

  it('cai quando a nota daqui a 3h é pelo menos 0.5 menor', () => {
    const slots = [{ hour: 10, score: 7 }, { hour: 13, score: 6 }]
    expect(computeTrend(slots, 10)).toBe('down')
  })

  it('fica estável quando a diferença é pequena (ruído)', () => {
    const slots = [{ hour: 10, score: 6 }, { hour: 13, score: 6.2 }]
    expect(computeTrend(slots, 10)).toBe('stable')
  })

  it('usa a última hora disponível quando +3h não existe (perto da meia-noite)', () => {
    const slots = [{ hour: 22, score: 4 }, { hour: 23, score: 8 }]
    expect(computeTrend(slots, 22)).toBe('up')
  })

  it('retorna null se a hora atual não estiver nos slots', () => {
    const slots = [{ hour: 10, score: 5 }]
    expect(computeTrend(slots, 15)).toBeNull()
  })

  it('retorna null se não houver hora futura depois da atual', () => {
    const slots = [{ hour: 10, score: 5 }]
    expect(computeTrend(slots, 10)).toBeNull()
  })
})
