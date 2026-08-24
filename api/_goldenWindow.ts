// Cálculo da "Janela de Ouro do Dia" — fonte única usada por hourly.ts.
// Prefixo _ indica que não é um handler HTTP — não será exposto como endpoint pelo Vercel.

import { getRatingInfo } from '../src/lib/rating.js'

export interface WindowSlot {
  hour: number
  label: string
  score: number
  waveHeight: number
  windSpeed: number
  windDirection: string
}

export interface GoldenWindow {
  startHour: number
  endHour: number
  startIdx: number
  endIdx: number
}

// Tier "BOM" (score >= 5.5, ver CLAUDE.md) é o piso considerado "janela boa" —
// reaproveita getRatingInfo em vez de duplicar o corte numérico de rating.ts.
const GOOD_ENOUGH_BARS = getRatingInfo(5.5).bars

// Expande a partir da melhor hora (peakHour) enquanto as horas vizinhas e contíguas
// se mantiverem no mesmo patamar "BOM" ou melhor — vira um intervalo, não só um instante.
// `sunriseHour`/`sunsetHour` (opcionais) travam a expansão dentro da luz do dia — sem isso,
// uma sequência "BOM" que atravessa o pôr do sol (ex: pico às 17h, ainda bom até 19h no
// modelo) virava janela recomendada incluindo horário escuro (achado 24/ago/2026: a
// seleção do pico em si já ficou restrita à luz do dia em hourly.ts, mas a EXPANSÃO da
// janela em volta dele também precisa respeitar o limite, não só o ponto de partida).
export function computeGoldenWindow(
  slots: WindowSlot[],
  peakHour: number,
  sunriseHour: number | null = null,
  sunsetHour: number | null = null
): GoldenWindow | null {
  const idx = slots.findIndex(s => s.hour === peakHour)
  if (idx === -1) return null

  // A própria hora de pico precisa ser "BOM" ou melhor — sem isso, um dia inteiro
  // ruim (nota máxima 3.0, por exemplo) ainda formava uma "janela" de uma hora só,
  // rotulada como boa condição (achado da auditoria de 22/ago/2026).
  if (getRatingInfo(slots[idx].score).bars < GOOD_ENOUGH_BARS) return null

  let start = idx
  while (
    start > 0 &&
    slots[start - 1].hour === slots[start].hour - 1 &&
    getRatingInfo(slots[start - 1].score).bars >= GOOD_ENOUGH_BARS &&
    (sunriseHour === null || slots[start - 1].hour >= sunriseHour)
  ) start--

  let end = idx
  while (
    end < slots.length - 1 &&
    slots[end + 1].hour === slots[end].hour + 1 &&
    getRatingInfo(slots[end + 1].score).bars >= GOOD_ENOUGH_BARS &&
    (sunsetHour === null || slots[end + 1].hour <= sunsetHour)
  ) end++

  return { startHour: slots[start].hour, endHour: slots[end].hour, startIdx: start, endIdx: end }
}

// Frase curta explicando por que a janela termina onde termina, comparando a última
// hora boa com a primeira hora ruim logo em seguida.
export function explainWindowEnd(slots: WindowSlot[], endIdx: number): string | null {
  const inside = slots[endIdx]
  const outside = slots[endIdx + 1]
  if (!inside || !outside) return null

  if (outside.windDirection !== inside.windDirection) {
    return `a partir das ${outside.label} o vento vira de ${outside.windDirection}`
  }
  if (outside.windSpeed - inside.windSpeed >= 5) {
    return `a partir das ${outside.label} o vento fica mais forte`
  }
  if (inside.waveHeight - outside.waveHeight >= 0.3) {
    return `a partir das ${outside.label} a ondulação perde força`
  }
  return `a condição cai a partir das ${outside.label}`
}
