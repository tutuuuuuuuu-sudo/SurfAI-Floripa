// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { computeGoldenWindow, explainWindowEnd, type WindowSlot } from './_goldenWindow'

function slot(hour: number, score: number, opts: Partial<WindowSlot> = {}): WindowSlot {
  return {
    hour,
    label: `${String(hour).padStart(2, '0')}h`,
    score,
    waveHeight: opts.waveHeight ?? 1.2,
    windSpeed: opts.windSpeed ?? 10,
    windDirection: opts.windDirection ?? 'W',
  }
}

describe('computeGoldenWindow', () => {
  it('expande para as horas vizinhas contíguas que também são BOM ou melhor', () => {
    const slots = [
      slot(6, 4.0), slot(7, 6.0), slot(8, 7.5), slot(9, 6.5), slot(10, 3.5),
    ]
    const window = computeGoldenWindow(slots, 8)
    expect(window).toEqual({ startHour: 7, endHour: 9, startIdx: 1, endIdx: 3 })
  })

  it('retorna um intervalo de uma hora só quando os vizinhos não são bons', () => {
    const slots = [slot(6, 3.0), slot(7, 8.0), slot(8, 3.0)]
    const window = computeGoldenWindow(slots, 7)
    expect(window).toEqual({ startHour: 7, endHour: 7, startIdx: 1, endIdx: 1 })
  })

  it('não expande através de um buraco nas horas (não contíguo)', () => {
    const slots = [slot(6, 7.0), slot(9, 7.0)]
    const window = computeGoldenWindow(slots, 6)
    expect(window).toEqual({ startHour: 6, endHour: 6, startIdx: 0, endIdx: 0 })
  })

  it('retorna null se a hora de pico não estiver na lista', () => {
    const slots = [slot(6, 7.0)]
    expect(computeGoldenWindow(slots, 12)).toBeNull()
  })
})

describe('explainWindowEnd', () => {
  it('explica virada de vento quando a direção muda na hora seguinte', () => {
    const slots = [
      slot(7, 7.0, { windDirection: 'W' }),
      slot(8, 7.0, { windDirection: 'W' }),
      slot(9, 3.0, { windDirection: 'NE' }),
    ]
    expect(explainWindowEnd(slots, 1)).toBe('a partir das 09h o vento vira de NE')
  })

  it('explica vento mais forte quando a direção não muda mas a velocidade sobe', () => {
    const slots = [
      slot(7, 7.0, { windDirection: 'W', windSpeed: 8 }),
      slot(8, 3.0, { windDirection: 'W', windSpeed: 20 }),
    ]
    expect(explainWindowEnd(slots, 0)).toBe('a partir das 08h o vento fica mais forte')
  })

  it('explica queda de ondulação quando vento se mantém estável', () => {
    const slots = [
      slot(7, 7.0, { windDirection: 'W', windSpeed: 8, waveHeight: 1.5 }),
      slot(8, 3.0, { windDirection: 'W', windSpeed: 9, waveHeight: 0.8 }),
    ]
    expect(explainWindowEnd(slots, 0)).toBe('a partir das 08h a ondulação perde força')
  })

  it('retorna null quando não há hora seguinte (janela vai até o fim dos dados)', () => {
    const slots = [slot(7, 7.0)]
    expect(explainWindowEnd(slots, 0)).toBeNull()
  })
})
