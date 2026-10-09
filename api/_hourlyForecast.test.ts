// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchHourlyForecast } from './_hourlyForecast'

// 14 dias hora a hora; o francês (modelo padrão) acaba na hora 200, como acontece de verdade
// (~8,5 dias), e o ECMWF vai até o fim
const HOURS = 14 * 24
const FRENCH_UNTIL = 200
const times = Array.from({ length: HOURS }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9, 9) + i * 3_600_000)
  return d.toISOString().slice(0, 13) + ':00'
})
const fill = <T,>(fn: (i: number) => T) => Array.from({ length: HOURS }, (_, i) => fn(i))
const french = (v: number) => fill(i => (i < FRENCH_UNTIL ? v : null))

function mockOpenMeteo() {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    let body: unknown
    if (url.includes('models=ecmwf_wam')) {
      // mar aberto 1,5 m nos dias em comum e 3 m no fim, período médio 8,5 s, de leste (100°)
      body = { hourly: { time: times, wave_height: fill(i => (i < FRENCH_UNTIL ? 1.5 : 3.0)), wave_period: fill(() => 8.5), wave_direction: fill(() => 100) } }
    } else if (url.includes('marine-api')) {
      body = { hourly: { time: times, wave_height: french(1.0), wave_period: french(7.5), swell_wave_height: french(0.9), swell_wave_period: french(7), swell_wave_direction: french(110), sea_surface_temperature: french(20) } }
    } else {
      body = { hourly: { wind_speed_10m: fill(() => 5), wind_direction_10m: fill(() => 290), temperature_2m: fill(() => 22) }, daily: { sunrise: [], sunset: [] } }
    }
    return new Response(JSON.stringify(body), { status: 200 })
  }))
}

afterEach(() => { vi.unstubAllGlobals() })

describe('fetchHourlyForecast — dias sem o modelo francês (09/out/2026)', () => {
  it('não inventa período de 10 s nem põe o mar aberto inteiro na praia', async () => {
    mockOpenMeteo()
    const f = await fetchHourlyForecast('-27.69', '-48.48', 14)
    const last = f!.readHour(HOURS - 12, 130)!
    // nos dias em comum: praia 1,0 m pra mar aberto 1,5 m (×0,67) e swell 7 s pra média 8,5 s (−1,5)
    expect(last.waveHeight).toBeCloseTo(2.0, 2)
    expect(last.swellPeriod).toBe(7)
    expect(last.swellDirection).toBe('E')
  })

  it('dias com o francês continuam iguais', async () => {
    mockOpenMeteo()
    const f = await fetchHourlyForecast('-27.69', '-48.48', 14)
    const first = f!.readHour(12, 130)!
    expect(first.waveHeight).toBe(1.0)
    expect(first.swellPeriod).toBe(7)
    expect(first.swellDirection).toBe('ESE')
  })
})
