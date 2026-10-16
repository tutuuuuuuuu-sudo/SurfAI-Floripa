// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { openSeaExposureAt, partExposure, exposedHeight, OPEN_SEA_EXPOSURE, type WavePart } from './_beachExposure'
import { getBeach } from './_beachRegistry'

const at = (id: string) => { const b = getBeach(id)!; return openSeaExposureAt(b.lat, b.lng)! }
const parts = (p: [number, number, number][]): WavePart[] =>
  p.map(([height, direction, period], i) => ({ height, direction, period, spread: i === 1 ? 2 : 12 }))

describe('quais praias usam o mar aberto', () => {
  it('as 5 que liam o ponto da baía, e só elas', () => {
    expect(Object.keys(OPEN_SEA_EXPOSURE).sort()).toEqual(['acores', 'armacao', 'morro-pedras', 'naufragados', 'solidao'])
    for (const id of ['campeche', 'matadeiro', 'lagoinha-leste', 'joaquina', 'barra-lagoa', 'santinho']) {
      const b = getBeach(id)!
      expect(openSeaExposureAt(b.lat, b.lng)).toBeNull()
    }
  })
})

describe('partExposure', () => {
  const morro = at('morro-pedras')
  it('onda de frente, com o caminho livre, chega quase inteira', () => {
    expect(partExposure(morro.open, morro.orientation, 100, 12)).toBeGreaterThan(0.85)
  })
  it('onda de onde a costa fecha o caminho (sul, no Morro das Pedras) quase não chega', () => {
    expect(partExposure(morro.open, morro.orientation, 200, 12)).toBeLessThan(0.05)
  })
})

// Mar aberto a sudeste da ilha (Open-Meteo, modelo francês) nas horas em que o mar real foi anotado:
// [altura, direção, período] da ondulação, das ondas de vento e da 2ª ondulação
describe('exposedHeight — conferido com o mar real', () => {
  it('Morro das Pedras 16/out 9h: boletim 1,0-1,3 m (o app mostrava 0,90)', () => {
    expect(exposedHeight(parts([[1.74, 119, 7.0], [0.82, 186, 3.4], [0.04, 247, 4.2]]), at('morro-pedras'))).toBeCloseTo(1.27, 1)
  })
  it('Morro das Pedras 15/out 9h: 0,4-0,6 m', () => {
    expect(exposedHeight(parts([[0.98, 153, 6.8], [0.02, 224, 0.1], [0.30, 69, 5.4]]), at('morro-pedras'))).toBeCloseTo(0.49, 1)
  })
  it('Armação 01/out 6h30: boletim 0,5-0,6 m (o app mostrava 0,70)', () => {
    expect(exposedHeight(parts([[1.04, 175, 6.8], [0.48, 188, 2.8], [0.84, 76, 7.0]]), at('armacao'))).toBeCloseTo(0.54, 1)
  })
  it('sem nenhuma parte do mar (dia além do modelo francês) devolve null', () => {
    expect(exposedHeight(parts([]), at('armacao'))).toBeNull()
    expect(exposedHeight([{ height: null, direction: null, period: null, spread: 12 }], at('armacao'))).toBeNull()
  })
})
