import { classifyWind } from '../../api/_scoreEngine'

// Significado das siglas de direção (padrão internacional em inglês, o mesmo que Windguru/
// Surfguru usam — N, E=leste, S, W=oeste). A sigla continua aparecendo e o nome vem ao lado,
// no formato que o usuário pediu em 25/set/2026: "NNW · norte noroeste" (as duas direções
// que formam a sigla, sem "entre x e y").
const DIRECTION_NAMES: Record<string, string> = {
  N: 'norte',
  NNE: 'norte nordeste',
  NE: 'nordeste',
  ENE: 'leste nordeste',
  E: 'leste',
  ESE: 'leste sudeste',
  SE: 'sudeste',
  SSE: 'sul sudeste',
  S: 'sul',
  SSW: 'sul sudoeste',
  SW: 'sudoeste',
  WSW: 'oeste sudoeste',
  W: 'oeste',
  WNW: 'oeste noroeste',
  NW: 'noroeste',
  NNW: 'norte noroeste',
}

export function directionName(code: string): string {
  const c = code.trim().split(' ')[0].toUpperCase()
  return DIRECTION_NAMES[c] ?? c
}

// Termos que o surfista brasileiro usa: terral (vem da terra, alisa a onda), maral (vem do
// mar, bagunça) e lateral. A classificação em si vive em api/_scoreEngine.ts (classifyWind),
// a mesma usada na nota — aqui é só o nome e a explicação pra tela.
export type WindEffect = 'terral' | 'lateral' | 'maral'

const EFFECT_BY_QUALITY = { offshore: 'terral', lateral: 'lateral', onshore: 'maral' } as const

export function windEffect(windDir: string, beachOrientation: number): WindEffect {
  return EFFECT_BY_QUALITY[classifyWind(windDir.trim().split(' ')[0].toUpperCase(), beachOrientation)]
}

export const WIND_EFFECT_INFO: Record<WindEffect, { label: string; hint: string; color: string; textCls: string }> = {
  terral:  { label: 'Terral',  hint: 'vem da terra, deixa a onda lisa',   color: 'var(--rating-good)', textCls: 'text-rating-good' },
  lateral: { label: 'Lateral', hint: 'sopra de lado, mexe um pouco a onda', color: 'var(--rating-fair)', textCls: 'text-rating-fair' },
  maral:   { label: 'Maral',   hint: 'vem do mar, bagunça a onda',        color: 'var(--rating-poor)', textCls: 'text-rating-poor' },
}
