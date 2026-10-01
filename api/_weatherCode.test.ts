import { describe, it, expect } from 'vitest'
import { mapWeatherCode, summarizeDaySky } from './_weatherCode'

const day = (codes: number[], startHour = 6) => codes.map((code, i) => ({ hour: startHour + i, code }))

describe('mapWeatherCode', () => {
  it('agrupa os códigos WMO em sol, nublado, chuva e tempestade', () => {
    expect(mapWeatherCode(0, true).label).toBe('Sol')
    expect(mapWeatherCode(0, false).label).toBe('Céu limpo')
    expect(mapWeatherCode(2, true).icon).toBe('cloud-sun')
    expect(mapWeatherCode(45, true).icon).toBe('cloud')
    expect(mapWeatherCode(61, true).icon).toBe('rain')
    expect(mapWeatherCode(95, true).icon).toBe('storm')
  })
})

describe('summarizeDaySky — céu do dia só nas horas de luz', () => {
  it('dia quase todo de sol vira "Sol"', () => {
    expect(summarizeDaySky(day([0, 0, 1, 1, 0, 1, 1, 0, 2, 2, 1, 0, 0]))?.label).toBe('Sol')
  })

  it('dia fechado vira "Nublado"', () => {
    expect(summarizeDaySky(day([3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 3, 3, 3]))?.label).toBe('Nublado')
  })

  it('mistura de sol e nuvem vira "Sol entre nuvens"', () => {
    expect(summarizeDaySky(day([1, 1, 2, 2, 3, 3, 2, 1, 2, 3, 2, 2, 1]))?.label).toBe('Sol entre nuvens')
  })

  it('uma ou duas horas de chuva viram "Chuva rápida" com o período do dia', () => {
    expect(summarizeDaySky(day([1, 1, 1, 1, 1, 1, 1, 1, 2, 61, 80, 2, 1]))?.label).toBe('Chuva rápida à tarde')
    expect(summarizeDaySky(day([61, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]))?.label).toBe('Chuva rápida de manhã')
  })

  it('chuva na maior parte do dia vira "Chuva"; tempestade sempre aparece', () => {
    expect(summarizeDaySky(day([61, 61, 63, 61, 61, 61, 61, 3, 3, 61, 61, 61, 61]))?.label).toBe('Chuva')
    expect(summarizeDaySky(day([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 95, 1, 1]))?.label).toBe('Tempestade à tarde')
  })

  it('sem dado não inventa nada', () => {
    expect(summarizeDaySky([])).toBeNull()
  })
})
