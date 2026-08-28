// Lógica de score de surf — fonte única de verdade para todas as APIs do backend.
// Prefixo _ indica que não é um handler HTTP — não será exposto como endpoint pelo Vercel.

export const WIND_DEG: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
  E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
  W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
}

export interface ScoreBreakdown {
  waveBase: number
  windPenalty: number
  windQuality: 'offshore' | 'lateral' | 'onshore'
  periodAdjust: number
  total: number
}

// Fonte única do cálculo — calculateSurfScore() abaixo só chama isto e pega o total.
// Existe separado (em vez de só retornar o número) pra que a UI que EXPLICA a nota pro
// usuário (ScoreExplainer.tsx) use os mesmos três números que compõem a nota de verdade,
// em vez de recalcular uma aproximação própria que pode não bater com o total.
// Pesos revistos em 28/ago/2026, a pedido explícito do usuário (founder, surfista local):
// tamanho de onda sozinho não faz um mar bom em Floripa — pode estar grande e mal-encaixado,
// ou com vento forte destruindo a forma. O usuário estimou a proporção real (não é medição,
// é julgamento de quem surfa a região): ~50% tamanho, ~30% vento, ~20% período/formato do
// swell. As faixas abaixo foram calibradas pra bater com essa proporção (raio de variação de
// cada componente: onda 6.0 pontos ≈ 54%, vento 3.0 ≈ 27%, período 2.2 ≈ 20% — aproximação,
// não exata, difícil bater 50/30/20 perfeito com um piso fixo de onda em 4.0).
//
// Os limiares de waveBase também foram multiplicados por 1.85 nesta mesma sessão, pra
// acompanhar a correção de viés do modelo bruto (ver MODEL_BIAS_CORRECTION em
// _liveConditions.ts) — sem isso, a mesma condição real de mar passaria a cair numa faixa
// mais alta só porque o número de entrada mudou de escala, não porque o mar ficou melhor.
export function explainSurfScore(
  waveHeight: number,
  windSpeed: number,
  swellPeriod: number,
  windDir: string,
  beachOrientation: number
): ScoreBreakdown {
  // Base de score pela altura da onda (limiares × 1.85 — ver comentário acima)
  let waveBase: number
  if (waveHeight >= 4.63) waveBase = 10
  else if (waveHeight >= 3.70) waveBase = 9.5
  else if (waveHeight >= 2.78) waveBase = 9.0
  else if (waveHeight >= 2.22) waveBase = 8.5
  else if (waveHeight >= 1.85) waveBase = 8.0
  else if (waveHeight >= 1.48) waveBase = 7.5
  else if (waveHeight >= 1.11) waveBase = 7.0
  else if (waveHeight >= 0.93) waveBase = 6.5
  else if (waveHeight >= 0.74) waveBase = 5.5
  else waveBase = 4.0

  // Penalização pelo vento considerando a orientação da praia (faixa reduzida de 4.0 pra
  // 3.0 de amplitude máxima, pra abrir espaço pro peso maior do período — ver comentário
  // acima sobre a proporção 50/30/20)
  const offshoreDir = (beachOrientation + 180) % 360
  let angleDiff = Math.abs((WIND_DEG[windDir] ?? 0) - offshoreDir)
  if (angleDiff > 180) angleDiff = 360 - angleDiff

  let windPenalty: number
  let windQuality: ScoreBreakdown['windQuality']
  if (angleDiff <= 45) {
    // Offshore — vento saindo do mar, deixa ondas limpas
    windQuality = 'offshore'
    windPenalty = windSpeed <= 10 ? 0 : windSpeed <= 15 ? -0.2 : windSpeed <= 20 ? -0.6 : -1.1
  } else if (angleDiff <= 90) {
    // Lateral
    windQuality = 'lateral'
    windPenalty = windSpeed <= 10 ? -0.4 : windSpeed <= 15 ? -0.8 : windSpeed <= 20 ? -1.4 : -1.9
  } else {
    // Onshore — vento bagunçando as ondas
    windQuality = 'onshore'
    windPenalty = windSpeed <= 10 ? -0.8 : windSpeed <= 15 ? -1.5 : windSpeed <= 20 ? -2.3 : -3.0
  }

  // Ajuste pelo período do swell (faixa ampliada de 1.1 pra 2.2 de amplitude — dobrou o peso
  // relativo do período, pra chegar mais perto dos ~20% que o usuário pediu)
  let periodAdjust: number
  if (swellPeriod >= 16) periodAdjust = 1.0
  else if (swellPeriod >= 14) periodAdjust = 0.6
  else if (swellPeriod >= 12) periodAdjust = 0.4
  else if (swellPeriod >= 10) periodAdjust = 0
  else if (swellPeriod >= 8) periodAdjust = -0.4
  else if (swellPeriod >= 7) periodAdjust = -0.8
  else periodAdjust = -1.2

  const total = Math.min(10, Math.max(1, Number((waveBase + windPenalty + periodAdjust).toFixed(1))))
  return { waveBase, windPenalty, windQuality, periodAdjust, total }
}

export function calculateSurfScore(
  waveHeight: number,
  windSpeed: number,
  swellPeriod: number,
  windDir: string,
  beachOrientation: number
): number {
  return explainSurfScore(waveHeight, windSpeed, swellPeriod, windDir, beachOrientation).total
}

// Corrige a altura de onda "crua" do modelo de oceano aberto pela exposição direcional
// da praia: swell alinhado com a praia (mesma direção de `beachOrientation`) chega quase
// sem perda; swell de lado perde energia por refração/difração que o modelo pontual não
// capta. Não substitui calibração local (camada 3) — só corrige o desalinhamento angular.
//
// Curva revista em 24/ago/2026: o piso duro de 0.55 (cos(ângulo), sem deixar cair mais que
// isso) cortava quase pela metade já a partir de ~57° de diferença — achado comparando as
// 14 praias monitoradas contra o Surfline (LOTUS): a altura saía sistematicamente abaixo
// do real em quase toda praia, não por ruído aleatório. A direção de swell que a Windy
// retorna é o ângulo de mar aberto, não o ângulo já refratado que chega de fato na praia
// (a própria física de refração — documentada pelo usuário pro Campeche — faz o litoral
// "capturar" mais energia do que o ângulo bruto sugere), e o piso antigo batia forte
// justo na faixa de 40-70° onde a maioria das leituras reais cai. Curva nova
// (`0.3 + 0.7·cos`, piso 30% só no desalinhamento extremo ~180°) é bem mais suave nessa
// faixa intermediária sem inflar demais o caso oposto total.
export function applyDirectionalExposure(
  waveHeight: number,
  swellDir: string,
  beachOrientation: number
): number {
  const swellDeg = WIND_DEG[swellDir]
  if (swellDeg === undefined) return waveHeight

  let angleDiff = Math.abs(swellDeg - beachOrientation)
  if (angleDiff > 180) angleDiff = 360 - angleDiff

  const exposureFactor = 0.3 + 0.7 * Math.max(0, Math.cos((angleDiff * Math.PI) / 180))
  return Number((waveHeight * exposureFactor).toFixed(1))
}
