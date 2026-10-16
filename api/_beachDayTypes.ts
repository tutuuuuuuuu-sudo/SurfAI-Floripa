// Tipos do resumo dos 14 dias das praias (api/_beachDays.ts), num arquivo só de tipos pra o app
// (src/lib/forecastWindows.ts) importar sem puxar o código do servidor.
// Prefixo _ = não exposto como endpoint HTTP pelo Vercel.

export interface BeachDay {
  date: string
  dayIndex: number        // 0 = hoje, mesmo índice da página do dia (/forecast/:id/day/:dayIndex)
  score: number           // nota do melhor horário de luz
  bestHour: number
  windowStart: number     // melhor janela (computeGoldenWindow); sem janela, igual ao melhor horário
  windowEnd: number
  waveMin: number         // onda na praia ao longo das horas de luz
  waveMax: number
  waveHeight: number      // onda, vento e período no melhor horário
  windSpeed: number
  windDirection: string
  swellPeriod: number
  tideTrend: string | null // maré no melhor horário
}

export interface BeachForecast { id: string; name: string; region: string; days: BeachDay[] }
