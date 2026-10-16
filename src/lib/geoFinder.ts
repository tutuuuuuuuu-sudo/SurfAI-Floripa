// Smart Geo-Finder — recomendação de praia por localização do usuário.
// Distância em linha reta (Haversine), sem depender de nenhum serviço externo de rotas.

import { getRatingInfo } from './rating'

export interface GeoBeach {
  id: string
  name: string
  lat: number
  lng: number
  score: number
  // Praias só acessíveis por trilha (Lagoinha do Leste, Naufragados) — a distância em
  // linha reta não tem como capturar 1h+ de caminhada, então nunca entram na conta de
  // "vale o desvio" (só podem aparecer como "mais perto" se literalmente forem).
  hikeAccess?: boolean
}

export interface GeoRecommendation {
  nearest: GeoBeach & { distanceKm: number }
  recommended: GeoBeach & { distanceKm: number }
  worthDetour: boolean
  extraDistanceKm: number
  // A recomendação final está pelo menos "BOM" (>=5.5)? Se não, nem a melhor opção por
  // perto está com condição boa — a UI usa isso pra não soar mais animada do que devia.
  recommendedIsGood: boolean
}

const EARTH_RADIUS_KM = 6371

// Praias além de +8km da mais perto não entram na comparação — ~12min de carro
// a mais, mesma referência de esforço citada no documento original da ideia.
const DETOUR_RADIUS_KM = 8

// Nota mínima de vantagem pra considerar que vale a pena rodar mais longe.
const SCORE_GAIN_THRESHOLD = 1.0

// Tier "BOM" (score >= 5.5, ver CLAUDE.md) — piso pra uma praia entrar como candidata a
// desvio. Sugerir rodar mais pra chegar a uma praia que ainda está "regular" ou pior é
// pior conselho que simplesmente mandar pra mais perto, mesmo se a nota melhorar um pouco.
const GOOD_ENOUGH_BARS = getRatingInfo(5.5).bars

export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Recomenda a praia mais perto, a menos que exista uma opção BOA (>=5.5) dentro de uma
// distância extra razoável e sem exigir trilha — nesse caso, recomenda o desvio.
export function recommendBeach(beaches: GeoBeach[], userLat: number, userLng: number): GeoRecommendation | null {
  if (beaches.length === 0) return null

  const withDistance = beaches.map(b => ({ ...b, distanceKm: haversineDistanceKm(userLat, userLng, b.lat, b.lng) }))
  const nearest = withDistance.reduce((a, b) => b.distanceKm < a.distanceKm ? b : a)

  const candidates = withDistance.filter(b =>
    b.distanceKm <= nearest.distanceKm + DETOUR_RADIUS_KM &&
    !b.hikeAccess &&
    getRatingInfo(b.score).bars >= GOOD_ENOUGH_BARS
  )
  const best = candidates.length > 0
    ? candidates.reduce((a, b) => b.score > a.score ? b : a)
    : nearest

  const worthDetour = best.id !== nearest.id && (best.score - nearest.score) >= SCORE_GAIN_THRESHOLD
  const recommended = worthDetour ? best : nearest

  return {
    nearest,
    recommended,
    worthDetour,
    extraDistanceKm: recommended.distanceKm - nearest.distanceKm,
    recommendedIsGood: getRatingInfo(recommended.score).bars >= GOOD_ENOUGH_BARS,
  }
}
