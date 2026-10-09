import { describe, it, expect } from 'vitest'
import { haversineDistanceKm, recommendBeach, type GeoBeach } from './geoFinder'

describe('haversineDistanceKm', () => {
  it('retorna 0 para o mesmo ponto', () => {
    expect(haversineDistanceKm(-27.6, -48.5, -27.6, -48.5)).toBe(0)
  })

  it('calcula ~1.11km por grau de latitude (aprox. na linha do equador de latitude)', () => {
    // 1 grau de latitude ~ 111km em qualquer lugar do globo
    const d = haversineDistanceKm(-27.0, -48.5, -28.0, -48.5)
    expect(d).toBeGreaterThan(110)
    expect(d).toBeLessThan(112)
  })
})

describe('recommendBeach', () => {
  const near: GeoBeach = { id: 'perto', name: 'Perto', lat: -27.60, lng: -48.50, score: 6.0 }
  const farButBetter: GeoBeach = { id: 'longe-melhor', name: 'Longe e Melhor', lat: -27.65, lng: -48.50, score: 8.5 }
  const farNotWorth: GeoBeach = { id: 'longe-parecida', name: 'Longe Parecida', lat: -27.65, lng: -48.50, score: 6.3 }
  const veryFarBetter: GeoBeach = { id: 'muito-longe', name: 'Muito Longe', lat: -28.20, lng: -48.50, score: 9.5 }
  const userLat = -27.60
  const userLng = -48.50

  it('retorna null para lista vazia', () => {
    expect(recommendBeach([], userLat, userLng)).toBeNull()
  })

  it('recomenda a mais perto quando não há opção melhor dentro do raio de desvio', () => {
    const result = recommendBeach([near, farNotWorth], userLat, userLng)!
    expect(result.nearest.id).toBe('perto')
    expect(result.worthDetour).toBe(false)
    expect(result.recommended.id).toBe('perto')
  })

  it('recomenda o desvio quando a opção dentro do raio é bem melhor (>= 1.0 nota)', () => {
    const result = recommendBeach([near, farButBetter], userLat, userLng)!
    expect(result.nearest.id).toBe('perto')
    expect(result.worthDetour).toBe(true)
    expect(result.recommended.id).toBe('longe-melhor')
    expect(result.extraDistanceKm).toBeGreaterThan(0)
  })

  it('não recomenda desvio pra praia melhor que está fora do raio, mesmo com nota bem maior', () => {
    const result = recommendBeach([near, veryFarBetter], userLat, userLng)!
    expect(result.worthDetour).toBe(false)
    expect(result.recommended.id).toBe('perto')
  })

  it('a própria praia mais perto pode ser a recomendada quando também é a melhor', () => {
    const result = recommendBeach([near], userLat, userLng)!
    expect(result.nearest.id).toBe('perto')
    expect(result.recommended.id).toBe('perto')
    expect(result.worthDetour).toBe(false)
  })

  // Bug real reportado: Campeche 1.1km nota 2.9 (RUIM) vs Lagoinha do Leste 8.4km nota
  // 4.4 (REGULAR) — o ganho de nota (1.5) passava do threshold, mas 4.4 ainda não é uma
  // praia boa. Recomendar rodar mais pra chegar a uma praia mediana é pior conselho que
  // simplesmente mandar pra mais perto.
  it('não recomenda desvio pra praia que continua abaixo de "BOM" (>=5.5), mesmo com ganho de nota', () => {
    const ruim: GeoBeach = { id: 'campeche', name: 'Campeche', lat: -27.60, lng: -48.50, score: 2.9 }
    const regular: GeoBeach = { id: 'lagoinha-leste', name: 'Lagoinha do Leste', lat: -27.675, lng: -48.50, score: 4.4 }
    const result = recommendBeach([ruim, regular], userLat, userLng)!
    expect(result.worthDetour).toBe(false)
    expect(result.recommended.id).toBe('campeche')
    expect(result.recommendedIsGood).toBe(false)
  })

  it('recomenda o desvio normalmente quando a opção melhor já passa de "BOM"', () => {
    const ruim: GeoBeach = { id: 'campeche', name: 'Campeche', lat: -27.60, lng: -48.50, score: 2.9 }
    const boa: GeoBeach = { id: 'morro-pedras', name: 'Morro das Pedras', lat: -27.63, lng: -48.50, score: 6.0 }
    const result = recommendBeach([ruim, boa], userLat, userLng)!
    expect(result.worthDetour).toBe(true)
    expect(result.recommended.id).toBe('morro-pedras')
    expect(result.recommendedIsGood).toBe(true)
  })

  // Lagoinha do Leste e Naufragados só têm acesso por trilha (1h+ de caminhada) — a
  // distância em linha reta não captura isso, então nunca devem ser sugeridas como desvio.
  it('nunca recomenda desvio pra praia de acesso por trilha, mesmo com nota ótima e perto', () => {
    const perto: GeoBeach = { id: 'campeche', name: 'Campeche', lat: -27.60, lng: -48.50, score: 4.0 }
    const trilha: GeoBeach = { id: 'lagoinha-leste', name: 'Lagoinha do Leste', lat: -27.605, lng: -48.50, score: 9.5, hikeAccess: true }
    const result = recommendBeach([perto, trilha], userLat, userLng)!
    expect(result.worthDetour).toBe(false)
    expect(result.recommended.id).toBe('campeche')
  })

  it('uma praia de trilha ainda pode aparecer como "mais perto" se for literalmente a mais perto', () => {
    const trilha: GeoBeach = { id: 'lagoinha-leste', name: 'Lagoinha do Leste', lat: -27.60, lng: -48.50, score: 3.0, hikeAccess: true }
    const result = recommendBeach([trilha], userLat, userLng)!
    expect(result.nearest.id).toBe('lagoinha-leste')
    expect(result.recommended.id).toBe('lagoinha-leste')
    expect(result.worthDetour).toBe(false)
  })
})
