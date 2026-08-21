// Smart Geo-Finder — recomendação de praia por localização do usuário.
// Distância em linha reta (Haversine), sem depender de nenhum serviço externo de rotas.

export interface GeoBeach {
  id: string
  name: string
  lat: number
  lng: number
  score: number
}

export interface GeoRecommendation {
  nearest: GeoBeach & { distanceKm: number }
  recommended: GeoBeach & { distanceKm: number }
  worthDetour: boolean
  extraDistanceKm: number
}

const EARTH_RADIUS_KM = 6371

// Praias além de +8km da mais perto não entram na comparação — ~12min de carro
// a mais, mesma referência de esforço citada no documento original da ideia.
const DETOUR_RADIUS_KM = 8

// Nota mínima de vantagem pra considerar que vale a pena rodar mais longe.
const SCORE_GAIN_THRESHOLD = 1.0

export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Recomenda a praia mais perto, a menos que exista uma opção bem melhor a uma
// distância extra razoável — nesse caso, recomenda o desvio.
export function recommendBeach(beaches: GeoBeach[], userLat: number, userLng: number): GeoRecommendation | null {
  if (beaches.length === 0) return null

  const withDistance = beaches.map(b => ({ ...b, distanceKm: haversineDistanceKm(userLat, userLng, b.lat, b.lng) }))
  const nearest = withDistance.reduce((a, b) => b.distanceKm < a.distanceKm ? b : a)

  const candidates = withDistance.filter(b => b.distanceKm <= nearest.distanceKm + DETOUR_RADIUS_KM)
  const best = candidates.reduce((a, b) => b.score > a.score ? b : a)

  const worthDetour = best.id !== nearest.id && (best.score - nearest.score) >= SCORE_GAIN_THRESHOLD
  const recommended = worthDetour ? best : nearest

  return { nearest, recommended, worthDetour, extraDistanceKm: recommended.distanceKm - nearest.distanceKm }
}
