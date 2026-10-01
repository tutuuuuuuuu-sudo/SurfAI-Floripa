import { describe, it, expect } from 'vitest'
import { degreesToWindDir, WIND_DEG, getSubRegionMatch, getWindAnalysis } from './surfData'

describe('degreesToWindDir', () => {
  it('0° = N', () => expect(degreesToWindDir(0)).toBe('N'))
  it('90° = E', () => expect(degreesToWindDir(90)).toBe('E'))
  it('180° = S', () => expect(degreesToWindDir(180)).toBe('S'))
  it('270° = W', () => expect(degreesToWindDir(270)).toBe('W'))
  it('45° = NE', () => expect(degreesToWindDir(45)).toBe('NE'))
  it('135° = SE', () => expect(degreesToWindDir(135)).toBe('SE'))
  it('315° = NW', () => expect(degreesToWindDir(315)).toBe('NW'))
  it('360° normaliza para N', () => expect(degreesToWindDir(360)).toBe('N'))
  it('valores intermediários arredondam corretamente (22° → NNE)', () => {
    expect(degreesToWindDir(22)).toBe('NNE')
  })
})

describe('WIND_DEG map', () => {
  it('tem todas as 16 direções', () => {
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
    dirs.forEach(d => expect(WIND_DEG[d]).toBeDefined())
  })

  it('graus são consistentes com degreesToWindDir (ida e volta)', () => {
    // Para cada direção no mapa, converter graus de volta deve dar a mesma direção
    const dirs = ['N','NE','E','SE','S','SW','W','NW'] as const
    dirs.forEach(d => {
      expect(degreesToWindDir(WIND_DEG[d])).toBe(d)
    })
  })
})

describe('getSubRegionMatch — pico estreito fora da direção ideal', () => {
  it('1 passo de direção não derruba mais a altura pela metade (Principal x Riozinho, 25/set/2026)', () => {
    // Principal (SE/SSE) com swell de ESE, vizinho do Riozinho (SE/ESE) que pega em cheio
    const principal = getSubRegionMatch(['SE', 'SSE'], 'ESE', 1.27, 'estreita', 1.0, 9, 12)
    const riozinho = getSubRegionMatch(['SE', 'ESE'], 'ESE', 1.2, 'estreita', 1.0, 9, 10)
    expect(principal.minDiff).toBe(1)
    // topo da faixa = a própria série desde 30/set/2026 (antes +15%): perde no máximo ~20%
    expect(Number(principal.waveMax)).toBeGreaterThanOrEqual(1.27 * 0.8)
    // Continua um pouco menor que o vizinho alinhado com o swell
    expect(Number(principal.waveMax)).toBeLessThan(Number(riozinho.waveMax))
    expect(principal.match).toBe('Swell bom')
  })
})

describe('getWindAnalysis — frase do vento acompanha a nota (30/set/2026)', () => {
  it('sul forte não sai mais como "pode atrapalhar um pouco"', () => {
    const t = getWindAnalysis('S', 22, 90)
    expect(t).toContain('sul (S) forte, de 22 km/h')
    expect(t).toContain('bagunçado')
    expect(t).not.toContain('um pouco')
  })

  it('sul e variações ficam mais duros a cada faixa de velocidade', () => {
    expect(getWindAnalysis('SSE', 12, 90)).toContain('já mexendo o mar')
    expect(getWindAnalysis('SSW', 16, 90)).toContain('mar mexido')
    expect(getWindAnalysis('S', 20, 90)).toContain('a onda se despedaça')
    expect(getWindAnalysis('S', 4, 90)).toContain('fraco')
  })

  it('terral fraco deixa o mar liso; terral forte não', () => {
    expect(getWindAnalysis('W', 8, 90)).toContain('liso e organizado')
    expect(getWindAnalysis('W', 25, 90)).not.toContain('liso')
  })

  it('maral de 10 km/h quase não pesa (outros ventos só estragam a partir de ~15 km/h)', () => {
    expect(getWindAnalysis('E', 10, 90)).toContain('quase sem efeito')
    expect(getWindAnalysis('E', 25, 90)).toContain('bagunçando')
  })
})

describe('getWindAnalysis — praia protegida do sul (01/out/2026)', () => {
  it('Matadeiro com sul de 20 km/h avisa que a praia é mais protegida e não diz "bagunçado"', () => {
    const t = getWindAnalysis('S', 20, 110, 0.5)
    expect(t).toContain('mais protegida do sul')
    expect(t).not.toContain('bagunçado')
  })
})
