import { describe, it, expect } from 'vitest'
import type { SurfSession } from './sessions'
import { learnIdealSea, findNextIdealSea, matchesIdealSea } from './idealSea'
import { weekStreak, monthSummary, yearRecap, surfedBeaches } from './sessionStats'
import { pickBestWindows } from './forecastWindows'
import type { BeachDay, BeachForecast } from '../../api/_beachDayTypes'

let n = 0
const session = (p: Partial<SurfSession>): SurfSession => ({
  id: String(n++), beach_id: 'campeche', beach_name: 'Campeche', date: '2026-10-09', start_hour: 7,
  duration_minutes: 90, rating: 4, notes: null, wave_height: 0.9, wind_speed: 5, wind_direction: 'NW',
  swell_period: 8, app_score: 7.5, tide_trend: 'enchendo', created_at: '', ...p,
})

const day = (p: Partial<BeachDay>): BeachDay => ({
  date: '2026-10-10', dayIndex: 1, score: 7, bestHour: 7, windowStart: 7, windowEnd: 9, waveMin: 0.8,
  waveMax: 1, waveHeight: 0.9, windSpeed: 5, windDirection: 'NW', swellPeriod: 8, tideTrend: 'enchendo', ...p,
})

describe('seu mar ideal', () => {
  it('precisa de 5 sessões com estrelas e mar registrado', () => {
    const s = [session({}), session({}), session({ wave_height: null }), session({ rating: null })]
    expect(learnIdealSea(s)).toEqual({ state: 'learning', rated: 2, needed: 3 })
  })

  it('aprende onda, vento, maré e praias das sessões de 4 e 5 estrelas', () => {
    const s = [
      session({ wave_height: 0.8, wind_speed: 4 }),
      session({ wave_height: 1.1, wind_speed: 12, wind_direction: 'W', beach_id: 'mole', beach_name: 'Praia Mole' }),
      session({ wave_height: 1.0, rating: 5 }),
      session({ wave_height: 2.0, rating: 1, wind_speed: 20, wind_direction: 'S', tide_trend: 'secando' }),
      session({ wave_height: 0.5, rating: 2 }),
    ]
    const r = learnIdealSea(s)
    expect(r.state).toBe('ready')
    if (r.state !== 'ready') return
    expect(r.ideal.waveMin).toBe(0.7)
    expect(r.ideal.waveMax).toBe(1.3)
    expect(r.ideal.windDirections).toEqual(['W'])
    expect(r.ideal.tideTrend).toBe('enchendo')
    expect(r.ideal.beaches[0]).toEqual({ id: 'campeche', name: 'Campeche', count: 2 })
  })

  it('sem sessões boas suficientes, avisa em vez de inventar', () => {
    const s = Array.from({ length: 5 }, () => session({ rating: 2 }))
    expect(learnIdealSea(s).state).toBe('no-likes')
  })

  const ideal = { waveMin: 0.7, waveMax: 1.3, maxWind: 12, windDirections: ['W'], tideTrend: 'enchendo' as const, beaches: [{ id: 'mole', name: 'Praia Mole', count: 2 }], basedOn: 3 }

  it('vento forte de outra direção ou maré contrária reprovam o dia', () => {
    expect(matchesIdealSea(ideal, day({}))).toBe(true)
    expect(matchesIdealSea(ideal, day({ windSpeed: 15, windDirection: 'S' }))).toBe(false)
    expect(matchesIdealSea(ideal, day({ windSpeed: 12, windDirection: 'W' }))).toBe(true)
    expect(matchesIdealSea(ideal, day({ tideTrend: 'secando' }))).toBe(false)
    expect(matchesIdealSea(ideal, day({ waveHeight: 1.6 }))).toBe(false)
  })

  it('acha o primeiro dia; no mesmo dia, a praia da pessoa vem antes', () => {
    const beaches: BeachForecast[] = [
      { id: 'campeche', name: 'Campeche', region: 'Sul', days: [day({ dayIndex: 0, waveHeight: 2 }), day({ dayIndex: 2, score: 8 })] },
      { id: 'mole', name: 'Praia Mole', region: 'Centro', days: [day({ dayIndex: 2, score: 6 })] },
    ]
    const next = findNextIdealSea(ideal, beaches)
    expect(next?.beachId).toBe('mole')
    expect(next?.day.dayIndex).toBe(2)
  })
})

describe('conquistas', () => {
  it('semanas seguidas: semana atual sem sessão ainda não quebra', () => {
    // hoje qui 09/10; sessões nas semanas de 29/09, 22/09 e 08/09 (buraco na de 15/09)
    const s = ['2026-10-01', '2026-09-24', '2026-09-23', '2026-09-10'].map(date => session({ date }))
    expect(weekStreak(s, '2026-10-09')).toBe(2)
    expect(weekStreak([...s, session({ date: '2026-10-06' })], '2026-10-09')).toBe(3)
    expect(weekStreak([], '2026-10-09')).toBe(0)
  })

  it('mês, passaporte e ano', () => {
    const s = [
      session({ date: '2026-10-02', duration_minutes: 60 }),
      session({ date: '2026-10-05', beach_id: 'mole', beach_name: 'Praia Mole', rating: 5, duration_minutes: 120 }),
      session({ date: '2026-09-20' }),
    ]
    expect(monthSummary(s, '2026-10-09')).toEqual({ count: 2, minutes: 180 })
    expect(surfedBeaches(s).get('campeche')).toBe(2)
    const y = yearRecap(s, '2026')
    expect(y.count).toBe(3)
    expect(y.beachCount).toBe(2)
    expect(y.favorite).toEqual({ name: 'Campeche', count: 2 })
    expect(y.best?.beach_id).toBe('mole')
  })
})

describe('melhores janelas da quinzena', () => {
  it('uma praia por dia, as maiores notas, em ordem de data, só janela boa', () => {
    const beaches: BeachForecast[] = [
      { id: 'a', name: 'A', region: 'Sul', days: [day({ dayIndex: 0, score: 6 }), day({ dayIndex: 1, score: 9 }), day({ dayIndex: 2, score: 4 })] },
      { id: 'b', name: 'B', region: 'Sul', days: [day({ dayIndex: 0, score: 7 }), day({ dayIndex: 1, score: 8.5 }), day({ dayIndex: 3, score: 8 })] },
    ]
    const w = pickBestWindows(beaches)
    expect(w.map(x => [x.day.dayIndex, x.beachId])).toEqual([[0, 'b'], [1, 'a'], [3, 'b']])
    expect(pickBestWindows(beaches, 3, 8.5).map(x => x.beachId)).toEqual(['a'])
   })

  it('no máximo uma janela de tendência (8º dia em diante)', () => {
    const beaches: BeachForecast[] = [{ id: 'a', name: 'A', region: 'Sul', days: [
      day({ dayIndex: 1, score: 6 }), day({ dayIndex: 8, score: 9.5 }), day({ dayIndex: 9, score: 9.4 }), day({ dayIndex: 10, score: 9.3 }),
    ] }]
    expect(pickBestWindows(beaches).map(w => w.day.dayIndex)).toEqual([1, 8])
  })
})
