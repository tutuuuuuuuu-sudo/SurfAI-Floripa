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
//
// Recalibração completa em 23-24/set/2026, a pedido explícito do usuário (founder, surfista
// local, mora no Campeche) — motivo: "Floripa funciona com mar pequeno" — o design de
// 28/ago (50% onda / 30% vento / 20% período) tratava tamanho de onda como o fator dominante,
// mas em Floripa o vento (e, secundariamente, o período) é o que decide se um mar pequeno é
// uma sessão excelente ou intragável, já que o tamanho quase nunca sai da faixa 0.3-1.5m.
//
// Achado crítico durante essa sessão: os limiares antigos de waveBase (4.63, 3.70, 2.78...)
// eram exatamente os valores reais (2.5, 2.0, 1.5...) × 1.85 — herança da correção de viés
// de modelo de 27-28/ago (ver MODEL_BIAS_CORRECTION em _liveConditions.ts). Só que em
// 28/ago/2026 a FONTE PRINCIPAL de dados (fetchOpenMeteo, modelo ecmwf_wam, usada em ~todo
// request) parou de aplicar essa correção — o comentário no próprio arquivo diz "NÃO aplica
// applyModelBiasCorrection aqui" — mas ninguém reverteu os limiares aqui. Resultado: pro
// caminho normal (quase sempre), uma onda REAL de 1.0m chegava aqui como 1.0 (sem inflar),
// mas a tabela esperava 1.85 pra representar esse mesmo 1.0m — a nota saía sistematicamente
// baixa demais. As tabelas abaixo já são calibradas direto em metros REAIS (sem qualquer
// multiplicador), compatível com o que fetchOpenMeteo entrega hoje. Windy/Stormglass
// (fallback raro) continuam aplicando ×1.85 no arquivo de dados, mas ali o propósito é outro
// — normalizar a leitura GFS pra equivaler à leitura ECMWF, não inflar pra combinar com uma
// tabela de score específica. Não precisa de ajuste aqui por causa disso.
//
// As faixas de onda, vento e período foram validadas contra 2 cenários reais descritos pelo
// usuário (0.75m + vento terral calmo + período 9-10s = nota 8; 0.6m nas mesmas condições =
// nota 7) e contra dado real de 30 dias (Open-Meteo Marine, Campeche e Naufragados): período
// acima de 11s não ocorreu nenhuma vez no mês, por isso o bônus máximo de período fica em
// 11s+, não em 16s+ como antes (mesma lógica nunca ocorreria de verdade). O vento passou a
// ter 3 curvas distintas (terral/offshore, lateral, maral/onshore) em vez de uma penalidade
// única — vento fraco e favorável agora SOMA pontos de verdade, não só deixa de descontar.
export function explainSurfScore(
  waveHeight: number,
  windSpeed: number,
  swellPeriod: number,
  windDir: string,
  beachOrientation: number
): ScoreBreakdown {
  // Base de score pela altura da onda, em metros reais (ver comentário acima — sem
  // multiplicador, compatível com o que a fonte principal de dados entrega hoje)
  let waveBase: number
  if (waveHeight >= 2.5) waveBase = 10
  else if (waveHeight >= 2.2) waveBase = 9.5
  else if (waveHeight >= 1.8) waveBase = 9.0
  else if (waveHeight >= 1.5) waveBase = 8.5
  else if (waveHeight >= 1.2) waveBase = 8.0
  else if (waveHeight >= 1.0) waveBase = 7.5
  else if (waveHeight >= 0.85) waveBase = 7.0
  else if (waveHeight >= 0.7) waveBase = 6.0
  else if (waveHeight >= 0.6) waveBase = 5.0
  else if (waveHeight >= 0.5) waveBase = 4.0
  else if (waveHeight >= 0.3) waveBase = 3.0
  else waveBase = 2.0

  // Ajuste pelo vento considerando a orientação da praia — 3 curvas diferentes, porque um
  // terral moderado-forte ainda mantém a onda em pé (o pior que faz é acelerar a onda), um
  // maral (onshore, bate de frente) bagunça a onda mesmo fraco, e o lateral fica no meio.
  const offshoreDir = (beachOrientation + 180) % 360
  let angleDiff = Math.abs((WIND_DEG[windDir] ?? 0) - offshoreDir)
  if (angleDiff > 180) angleDiff = 360 - angleDiff

  let windPenalty: number
  let windQuality: ScoreBreakdown['windQuality']
  if (angleDiff <= 45) {
    // Offshore/terral — vento saindo do mar, mantém a onda organizada até ficar forte de verdade
    windQuality = 'offshore'
    windPenalty = windSpeed <= 3 ? 1.5 : windSpeed <= 10 ? 1.2 : windSpeed <= 15 ? 1.0 : windSpeed <= 20 ? -0.4 : -1.0
  } else if (angleDiff <= 90) {
    // Lateral — fraco quase não atrapalha, só pesa de verdade quando fica forte
    windQuality = 'lateral'
    windPenalty = windSpeed <= 5 ? 1.3 : windSpeed <= 10 ? 1.0 : windSpeed <= 15 ? -0.5 : windSpeed <= 20 ? -1.0 : -1.5
  } else {
    // Onshore/maral — bate de frente e bagunça a onda mesmo em velocidade baixa
    windQuality = 'onshore'
    windPenalty = windSpeed <= 3 ? 1.0 : windSpeed <= 5 ? 0 : windSpeed <= 10 ? -0.8 : windSpeed <= 15 ? -1.5 : windSpeed <= 20 ? -2.3 : -3.0
  }

  // Ajuste pelo período do swell, comprimido pra faixa que realmente acontece em Floripa —
  // dado real de 30 dias mostrou 0% de ocorrência acima de 11s (ver comentário acima)
  let periodAdjust: number
  if (swellPeriod >= 11) periodAdjust = 1.4
  else if (swellPeriod >= 9) periodAdjust = 1.1
  else if (swellPeriod >= 7) periodAdjust = 0.8
  else if (swellPeriod >= 4) periodAdjust = 0.3
  else periodAdjust = -0.5

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
