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

// Expande a partir da melhor hora (peakHour) enquanto as horas vizinhas e contíguas ficam
// no MESMO patamar de cor da melhor hora (mesmo tier de getRatingInfo), ou quase empatadas
// com ela (até PEAK_TOLERANCE abaixo — evita cortar uma janela de 8.6 ÉPICO só porque a hora
// ao lado deu 8.4 EXCELENTE). Antes (até 25/set/2026) expandia enquanto fosse "BOM ou
// melhor", e o usuário achou a incoerência no gráfico: "janela boa vai até 15h", mas o
// azul de EXCELENTE acabava às 12h e das 13h às 15h já era verde (BOM, 5.5-5.6) com vento
// entrando. Janela boa tem que ser a faixa que o gráfico pinta igual à melhor hora.
// `sunriseHour`/`sunsetHour` (opcionais) travam a expansão dentro da luz do dia — sem isso,
// uma sequência boa que atravessa o pôr do sol virava janela recomendada incluindo horário
// escuro (achado 24/ago/2026).
const PEAK_TOLERANCE = 0.3

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
  const peak = slots[idx]
  const peakBars = getRatingInfo(peak.score).bars
  if (peakBars < GOOD_ENOUGH_BARS) return null

  const belongs = (s: WindowSlot) => {
    const bars = getRatingInfo(s.score).bars
    return bars >= GOOD_ENOUGH_BARS && (bars >= peakBars || s.score >= peak.score - PEAK_TOLERANCE)
  }

  let start = idx
  while (
    start > 0 &&
    slots[start - 1].hour === slots[start].hour - 1 &&
    belongs(slots[start - 1]) &&
    (sunriseHour === null || slots[start - 1].hour >= sunriseHour)
  ) start--

  let end = idx
  while (
    end < slots.length - 1 &&
    slots[end + 1].hour === slots[end].hour + 1 &&
    belongs(slots[end + 1]) &&
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
