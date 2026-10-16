// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { windHeightFactor, applyBeachWind } from './_beachWindHeight'
import { getBeach } from './_beachRegistry'

const campeche = getBeach('campeche')!
const morro = getBeach('morro-pedras')!

describe('vento sul no Campeche', () => {
  it('até 5 km/h não muda; 15 km/h ou mais tira 35%', () => {
    expect(windHeightFactor('campeche', 'S', 5)).toBe(1)
    expect(windHeightFactor('campeche', 'S', 10)).toBeCloseTo(0.825, 3)
    expect(windHeightFactor('campeche', 'SSE', 15)).toBeCloseTo(0.65, 3)
    expect(windHeightFactor('campeche', 'SSW', 25)).toBeCloseTo(0.65, 3)
  })

  it('outros ventos não mudam (os 3 dias em que o app acertou)', () => {
    expect(windHeightFactor('campeche', 'N', 19)).toBe(1)   // 24/set
    expect(windHeightFactor('campeche', 'NE', 3)).toBe(1)   // 30/set
    expect(windHeightFactor('campeche', 'WSW', 5)).toBe(1)  // 15/out
    expect(windHeightFactor('campeche', 'SE', 20)).toBe(1)  // sudeste não é o sul da regra
  })

  it('16/out: app 1,11 (7h, sul 12) e 1,19 (8h, sul 16) caem pra dentro do real 0,6-0,9', () => {
    const at7 = applyBeachWind(1.11, campeche.lat, campeche.lng, 'S', 12)
    const at8 = applyBeachWind(1.19, campeche.lat, campeche.lng, 'S', 16)
    expect(at7).toBeCloseTo(0.84, 2)
    expect(at8).toBeCloseTo(0.77, 2)
  })

  it('só no Campeche: Morro das Pedras com o mesmo sul fica igual (16/out teve o tamanho do mar aberto)', () => {
    expect(applyBeachWind(1.27, morro.lat, morro.lng, 'S', 16)).toBe(1.27)
  })
})
