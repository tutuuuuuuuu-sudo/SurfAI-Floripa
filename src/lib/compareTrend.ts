// Tendência de curto prazo usada no Comparador de Picos — reaproveita o mesmo
// cálculo hora a hora de api/hourly.ts (o mesmo dado do card "Melhor Janela do Dia"),
// sem duplicar nenhuma lógica de score.

export type Trend = 'up' | 'down' | 'stable'

export interface TrendSlot {
  hour: number
  score: number
}

// Diferença mínima de nota pra não tratar ruído de arredondamento como tendência real.
const TREND_DELTA = 0.5
const LOOKAHEAD_HOURS = 3

// Compara a nota de agora com a nota de ~3h à frente. Se não houver dado pra
// exatamente +3h (ex: perto da meia-noite), usa a última hora disponível do dia.
export function computeTrend(slots: TrendSlot[], nowHour: number): Trend | null {
  const current = slots.find(s => s.hour === nowHour)
  if (!current) return null

  const future = slots.find(s => s.hour === nowHour + LOOKAHEAD_HOURS)
    ?? [...slots].reverse().find(s => s.hour > nowHour)
  if (!future) return null

  const delta = future.score - current.score
  if (delta >= TREND_DELTA) return 'up'
  if (delta <= -TREND_DELTA) return 'down'
  return 'stable'
}
