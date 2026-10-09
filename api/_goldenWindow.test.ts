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
  it('expande só pelas horas vizinhas na mesma cor da melhor hora', () => {
    const slots = [
      slot(6, 4.0), slot(7, 7.1), slot(8, 7.5), slot(9, 7.2), slot(10, 6.5),
    ]
    const window = computeGoldenWindow(slots, 8)
    expect(window).toEqual({ startHour: 7, endHour: 9, startIdx: 1, endIdx: 3 })
  })

  it('não estica a janela EXCELENTE por horas que já caíram pra BOM (caso do usuário, 25/set/2026)', () => {
    // Excelente até 12h, depois 5.5-5.8 (BOM) até 15h com vento entrando
    const slots = [
      slot(10, 7.6), slot(11, 7.4), slot(12, 7.0), slot(13, 5.8), slot(14, 5.5), slot(15, 5.6), slot(16, 4.2),
    ]
    const window = computeGoldenWindow(slots, 10)
    expect(window?.endHour).toBe(12)
  })

  it('inclui vizinha quase empatada mesmo de cor diferente (8.6 ÉPICO ao lado de 8.4)', () => {
    const slots = [slot(8, 8.4), slot(9, 8.6), slot(10, 7.9)]
    const window = computeGoldenWindow(slots, 9)
    expect(window).toEqual({ startHour: 8, endHour: 9, startIdx: 0, endIdx: 1 })
  })

  it('janela de dia BOM continua podendo ser longa (tudo verde)', () => {
    const slots = [slot(7, 5.6), slot(8, 6.2), slot(9, 5.9), slot(10, 5.5)]
    const window = computeGoldenWindow(slots, 8)
    expect(window).toEqual({ startHour: 7, endHour: 10, startIdx: 0, endIdx: 3 })
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

  it('retorna null quando o dia inteiro é ruim, mesmo a "melhor" hora não sendo BOM', () => {
    const slots = [slot(6, 2.5), slot(7, 3.0), slot(8, 2.0)]
    expect(computeGoldenWindow(slots, 7)).toBeNull()
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
