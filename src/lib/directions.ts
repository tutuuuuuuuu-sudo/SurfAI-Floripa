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
