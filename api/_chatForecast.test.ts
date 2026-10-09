import { describe, it, expect } from 'vitest'
import { dayLabel, tideTrendAt, tideEventsByDay, formatBeachDay, formatTrendDay } from './_chatForecast'
import { summarizeDay } from './_beachDays'

describe('dayLabel', () => {
  it('marca hoje e amanhã e usa dia da semana no resto', () => {
    expect(dayLabel('2026-09-25', '2026-09-25')).toBe('hoje (sex 25/09)')
    expect(dayLabel('2026-09-26', '2026-09-25')).toBe('amanhã (sáb 26/09)')
    expect(dayLabel('2026-09-28', '2026-09-25')).toBe('seg 28/09')
  })
})

const tide = {
  times: ['2026-09-26T06:00', '2026-09-26T07:00', '2026-09-26T08:00', '2026-09-26T09:00', '2026-09-26T10:00'],
  heights: [0.1, 0.3, 0.5, 0.4, 0.2],
}

describe('maré', () => {
  it('diz se está enchendo ou secando numa hora', () => {
    expect(tideTrendAt(tide, '2026-09-26', 6)).toBe('enchendo')
    expect(tideTrendAt(tide, '2026-09-26', 9)).toBe('secando')
    expect(tideTrendAt(null, '2026-09-26', 6)).toBeNull()
  })
  it('acha o horário da maré alta', () => {
    expect(tideEventsByDay(tide).get('2026-09-26')).toEqual(['alta 08h'])
  })
})

const h = (hour: number, score: number, waveHeight = 1 + hour / 100) => ({
  hour, score, waveHeight, swellPeriod: 10, swellDirection: 'SE',
  windSpeed: 8, windDirection: 'NW', temperature: 20, weatherCode: null, rainChance: null, waterTemp: null,
})

describe('formatBeachDay', () => {
  it('traz onda, melhor horário, vento com nome da direção, maré e período', () => {
    const day = summarizeDay('2026-09-26', 1, [h(5, 9), h(7, 7.4), h(8, 7.5), h(9, 7.3), h(12, 5)], 6, 18, () => 'enchendo')!
    expect(formatBeachDay('sáb 26/09', day)).toBe('sáb 26/09: onda 1.1-1.1m, melhor horário 07h às 09h (nota 7.5), vento 8km/h NW (noroeste), maré enchendo, período 10s')
  })
  it('ignora horas de noite', () => {
    expect(summarizeDay('2026-09-26', 1, [h(3, 9), h(21, 9)], 6, 18, () => null)).toBeNull()
  })
})

describe('formatTrendDay (8º ao 14º dia)', () => {
  it('traz só a faixa de onda e a nota do melhor horário de luz', () => {
    const day = summarizeDay('2026-10-17', 8, [h(4, 9.9, 3), h(7, 6.3, 1.5), h(12, 5, 2.2)], 6, 18, () => null)!
    expect(formatTrendDay('sáb 17/10', day)).toBe('sáb 17/10 1.5-2.2m nota 6.3')
  })
})
