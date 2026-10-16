// Vento que diminui a onda numa praia específica (16/out/2026). Prefixo _ = não exposto como endpoint.
//
// Campeche com vento sul: o usuário (surfista local, mora no Campeche) já tinha dito em 01/out que
// "swell bom com sul de 20 km/h no Campeche fica extremamente ruim — não tem formação, o mar fica
// mexido, a onda se despedaça". Os registros do mar real batem: dos 4 dias anotados no Campeche, o
// único com vento sul é o único em que o app errou.
// - 24/set (norte 19 km/h): real 1,0-1,5, app 1,35
// - 30/set (nordeste 3 km/h): real 0,8-1,2, app 1,04
// - 15/out (oés-sudoeste 5 km/h): real ~0,55, app 0,55
// - 16/out 7-8h (sul 12-16 km/h): real 0,6-0,9, app 1,11-1,19 (×0,65 do que o app mostrava)
// No mesmo 16/out o Morro das Pedras, virado mais pra leste (o sul pega de lado), teve o tamanho
// do mar aberto (1,0-1,3 m) — por isso a regra é por praia, não pra todas.
// É uma regra tirada de um dia só com vento sul: vai sendo conferida com o Registro do mar real.
// Errando, erra pra menos, que é o que o usuário prefere (nunca mostrar mar maior que o real).

import { beachAt } from './_beachRegistry.js'

interface WindHeightRule {
  winds: Set<string>
  // Velocidade (km/h) em que começa a diminuir e em que chega no mínimo; entre as duas, linha reta
  fromKmh: number
  toKmh: number
  minFactor: number
}

const RULES: Record<string, WindHeightRule> = {
  // Mesma definição de vento sul da nota (SOUTH_WINDS em _scoreEngine.ts)
  campeche: { winds: new Set(['S', 'SSE', 'SSW']), fromKmh: 5, toKmh: 15, minFactor: 0.65 },
}

export function windHeightFactor(beachId: string | undefined, windDir: string, windSpeedKmh: number): number {
  const rule = beachId ? RULES[beachId] : undefined
  if (!rule || !rule.winds.has(windDir) || !(windSpeedKmh > rule.fromKmh)) return 1
  const t = Math.min(1, (windSpeedKmh - rule.fromKmh) / (rule.toKmh - rule.fromKmh))
  return 1 - t * (1 - rule.minFactor)
}

// Altura com o vento da praia na coordenada (as rotas recebem lat/lng, não o id)
export function applyBeachWind(height: number, lat: number, lng: number, windDir: string, windSpeedKmh: number): number {
  const factor = windHeightFactor(beachAt(lat, lng)?.id, windDir, windSpeedKmh)
  return factor === 1 ? height : Math.round(height * factor * 100) / 100
}
