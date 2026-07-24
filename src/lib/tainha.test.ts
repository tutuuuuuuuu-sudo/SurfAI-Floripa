import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isTainhaSeasonActive, getTainhaInfo } from './tainha'

function mockDate(month: number, day: number) {
  const date = new Date(2026, month - 1, day)
  vi.setSystemTime(date)
}

describe('isTainhaSeasonActive', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('1 de maio → ativa', () => { mockDate(5, 1); expect(isTainhaSeasonActive()).toBe(true) })
  it('15 de junho → ativa', () => { mockDate(6, 15); expect(isTainhaSeasonActive()).toBe(true) })
  it('31 de julho → ativa', () => { mockDate(7, 31); expect(isTainhaSeasonActive()).toBe(true) })
  it('30 de abril → inativa', () => { mockDate(4, 30); expect(isTainhaSeasonActive()).toBe(false) })
  it('1 de agosto → inativa', () => { mockDate(8, 1); expect(isTainhaSeasonActive()).toBe(false) })
  it('dezembro → inativa', () => { mockDate(12, 15); expect(isTainhaSeasonActive()).toBe(false) })
})

describe('getTainhaInfo', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('fora da temporada → status fora-temporada para qualquer praia', () => {
    mockDate(3, 10)
    expect(getTainhaInfo('joaquina').status).toBe('fora-temporada')
    expect(getTainhaInfo('campeche').status).toBe('fora-temporada')
  })

  it('durante temporada: joaquina → liberada', () => {
    mockDate(6, 15)
    expect(getTainhaInfo('joaquina').status).toBe('liberada')
  })

  it('durante temporada: mole → liberada', () => {
    mockDate(6, 15)
    expect(getTainhaInfo('mole').status).toBe('liberada')
  })

  it('durante temporada: armacao → parcial', () => {
    mockDate(6, 15)
    expect(getTainhaInfo('armacao').status).toBe('parcial')
  })

  it('durante temporada: praia sem mapeamento → fora-temporada (sem restrição real)', () => {
    mockDate(6, 15)
    expect(getTainhaInfo('praia-desconhecida').status).toBe('fora-temporada')
  })

  it('message vazio fora da temporada', () => {
    mockDate(3, 10)
    expect(getTainhaInfo('joaquina').message).toBe('')
  })
})
