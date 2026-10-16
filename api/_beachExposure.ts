// Onda na praia a partir do MAR ABERTO na frente dela, pela direção de cada ondulação (16/out/2026).
// Prefixo _ = não exposto como endpoint HTTP pelo Vercel.
//
// Por que existe: o modelo francês (base da altura desde 01/out, ver _beachHeight.ts) tem um ponto a
// cada ~9 km e cada praia pegava o mais perto. Morro das Pedras, Armação, Solidão, Açores e
// Naufragados caíam todas no mesmo ponto, do lado da BAÍA, atrás da ilha (-27.708, -48.542):
// sempre ~2/3 do que o mar aberto dava, com qualquer ondulação. Em 16/out o usuário viu o Morro
// das Pedras com 1,0-1,3 m (boletim) e o app mostrava 0,90.
//
// Como é a conta: o mar aberto a sudeste da ilha vem separado em ondulação, 2ª ondulação e ondas de
// vento, cada uma com altura, direção e período. Pra cada uma, soma quanto da energia chega na
// praia: só as direções sem costa no caminho (janelas abaixo) e menos quanto mais de lado a onda
// bate na frente da praia. Depois o fator do período (onda curta perde força antes de quebrar).
//
// As janelas saíram do contorno da costa do OpenStreetMap (natural=coastline, 738 trechos): de
// cada praia, uma linha a cada 1° até 80 km; direção que bate em costa antes disso é fechada,
// menos ilhota estreita (até 6°) a mais de 5 km, que a onda contorna. Scripts e dados em
// .content-drafts/ondas-exposicao/ (fora do git).
//
// Conferido com os registros reais dessas praias (com a conta antiga entre parênteses):
// - Morro das Pedras 16/out, boletim 1,0-1,3: 1,27 (0,90)
// - Morro das Pedras 15/out, 0,4-0,6 (o usuário disse que o app acertou): 0,49 (0,48)
// - Morro das Pedras 01/out, boletim 0,5-0,6: 0,63 (0,70)
// - Armação 01/out, boletim 0,5-0,6: 0,54 (0,70)
// No Campeche a mesma conta NÃO bateu (16/out 1,15 com real 0,6-0,9; 30/set 0,68 com real
// 0,8-1,2), por isso ele e as outras praias continuam com a conta de _beachHeight.ts até haver
// mais registros (memória project-wave-grid-points-2026-10-16).

import { beachAt } from './_beachRegistry.js'
import { beachHeightFactor } from './_beachHeight.js'

export interface OpenSeaExposure {
  // Ponto de mar aberto do modelo francês (grade de 1/12°) de onde vêm as ondulações
  point: [number, number]
  // Direções (graus de onde a onda vem) sem costa no caminho até a praia
  open: [number, number][]
}

// Ponto a sudeste da ilha, longe da costa: em 16/out 10h dava 1,94 m, contra 0,92 no ponto da baía
const SOUTHEAST_OPEN_SEA: [number, number] = [-27.7917, -48.375]

export const OPEN_SEA_EXPOSURE: Record<string, OpenSeaExposure> = {
  'morro-pedras': { point: SOUTHEAST_OPEN_SEA, open: [[34, 49], [66, 152]] },
  armacao: { point: SOUTHEAST_OPEN_SEA, open: [[32, 110]] },
  solidao: { point: SOUTHEAST_OPEN_SEA, open: [[89, 145], [155, 162], [179, 197]] },
  acores: { point: SOUTHEAST_OPEN_SEA, open: [[116, 159], [168, 176], [189, 202]] },
  naufragados: { point: SOUTHEAST_OPEN_SEA, open: [[128, 189]] },
}

// Praia na coordenada que usa essa conta (com a direção pra onde ela está virada), ou null
export function openSeaExposureAt(lat: number, lng: number): (OpenSeaExposure & { orientation: number }) | null {
  const beach = beachAt(lat, lng)
  const exposure = beach && OPEN_SEA_EXPOSURE[beach.id]
  return exposure ? { ...exposure, orientation: beach.orientation } : null
}

// Espalhamento das direções em volta da média (cos^2s da metade do ângulo): ondulação chega
// concentrada, onda de vento chega de um leque bem mais largo
const SWELL_SPREAD = 12
const WIND_SEA_SPREAD = 2

const rad = (deg: number) => (deg * Math.PI) / 180
const isOpen = (open: [number, number][], deg: number) => open.some(([from, to]) => deg >= from && deg <= to)

// Fração da energia de uma ondulação (direção média + espalhamento) que chega na praia
export function partExposure(open: [number, number][], orientation: number, direction: number, spread: number): number {
  let reaching = 0, total = 0
  for (let deg = 0; deg < 360; deg++) {
    const diff = ((deg - direction + 540) % 360) - 180
    const weight = Math.pow(Math.cos(rad(diff) / 2), 2 * spread)
    total += weight
    if (!isOpen(open, deg)) continue
    const facing = Math.cos(rad(deg - orientation))
    if (facing > 0) reaching += weight * facing
  }
  return total > 0 ? reaching / total : 0
}

export interface WavePart { height?: number | null; direction?: number | null; period?: number | null; spread: number }

// Campos do Open-Meteo marine (current= ou hourly=) com as partes do mar
export const WAVE_PART_FIELDS = [
  'swell_wave_height', 'swell_wave_direction', 'swell_wave_period',
  'wind_wave_height', 'wind_wave_direction', 'wind_wave_period',
  'secondary_swell_wave_height', 'secondary_swell_wave_direction', 'secondary_swell_wave_period',
].join(',')

type FieldReader = (field: string) => number | null | undefined
export function wavePartsFrom(read: FieldReader): WavePart[] {
  const part = (prefix: string, spread: number): WavePart => ({
    height: read(`${prefix}_height`), direction: read(`${prefix}_direction`), period: read(`${prefix}_period`), spread,
  })
  return [part('swell_wave', SWELL_SPREAD), part('wind_wave', WIND_SEA_SPREAD), part('secondary_swell_wave', SWELL_SPREAD)]
}

// Altura na praia (m, duas casas) somando a energia de cada parte que chega; null se o ponto de
// mar aberto não tem nenhuma parte (dia além do modelo francês, ~8,5 dias)
export function exposedHeight(parts: WavePart[], exposure: { open: [number, number][]; orientation: number }): number | null {
  let energy = 0, any = false
  for (const p of parts) {
    if (p.height == null || !Number.isFinite(p.height)) continue
    any = true
    if (p.height <= 0 || p.direction == null) continue
    const factor = beachHeightFactor(p.period ?? 8)
    energy += p.height ** 2 * partExposure(exposure.open, exposure.orientation, p.direction, p.spread) * factor ** 2
  }
  return any ? Math.round(Math.sqrt(energy) * 100) / 100 : null
}
