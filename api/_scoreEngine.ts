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
// Terral (offshore), lateral ou maral (onshore) — fonte única dessa classificação, usada
// pela nota logo abaixo E pela UI (rosa dos ventos, textos de análise). `beachOrientation` é
// pra onde a praia "olha" (o mar); o terral vem do lado oposto, da terra.
export function classifyWind(windDir: string, beachOrientation: number): ScoreBreakdown['windQuality'] {
  const offshoreDir = (beachOrientation + 180) % 360
  let angleDiff = Math.abs((WIND_DEG[windDir] ?? 0) - offshoreDir)
  if (angleDiff > 180) angleDiff = 360 - angleDiff
  if (angleDiff <= 45) return 'offshore'
  if (angleDiff <= 90) return 'lateral'
  return 'onshore'
}

export function explainSurfScore(
  waveHeight: number,
  windSpeed: number,
  swellPeriod: number,
  windDir: string,
  beachOrientation: number,
  southExposure = 1,
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

  // Ajuste pelo vento: o sul (e variações) tem curva própria; os outros dependem de como
  // entram na praia (terral, lateral, maral). Os valores andam em linha reta entre os pontos
  // (km/h → pontos), sem degrau: 1 km/h a mais não pode derrubar a nota de uma vez.
  const windQuality = classifyWind(windDir, beachOrientation)
  const south = southWindHits(windDir, beachOrientation)
  const windCurve = south ? WIND_SOUTH
    : windQuality === 'offshore' ? WIND_OFFSHORE
    : windQuality === 'lateral' ? WIND_LATERAL
    : WIND_ONSHORE
  // Praia protegida do sul sente o vento como se fosse mais fraco (Matadeiro 0,5 → sul de 20 km/h
  // pesa como 10 km/h); ver southExposure em api/_beachRegistry.ts
  const effectiveSpeed = south ? windSpeed * Math.min(1, Math.max(0, southExposure)) : windSpeed
  const windPenalty = round1(interpolate(windCurve, effectiveSpeed))

  // Ajuste pelo período médio do swell (swell_wave_period da Open-Meteo)
  const periodAdjust = round1(interpolate(PERIOD, swellPeriod))

  const total = Math.min(10, Math.max(1, Number((waveBase + windPenalty + periodAdjust).toFixed(1))))
  return { waveBase, windPenalty, windQuality, periodAdjust, total }
}

// Recalibração de 30/set/2026, com o usuário (surfista local), depois de a landing mostrar 13 das
// 14 praias como "épico" num mar de 1,4 m com período de 6 s, e o Campeche com 8,3 com vento sul
// de 15 km/h. Pontos [valor medido, ajuste na nota]; fora das pontas vale o valor da ponta.
//
// Vento sul (S, SSE, SSW): o pior vento de Floripa. Chega com a frente fria, entra de lado ou
// de frente em quase todas as praias e já desmancha o mar com 10 km/h — por isso, de lado ou de
// frente, usa a curva própria (pro Campeche a conta geométrica chamava de "lateral" e quase não
// descontava). Nunca fica mais brando que o maral na mesma velocidade.
const SOUTH_WINDS = new Set(['S', 'SSE', 'SSW'])
// Exceção (01/out/2026): onde o sul sopra da terra (terral), ele segura a onda como qualquer terral
// e usa a curva do terral. Com a orientação medida no mapa, isso vale pro sul e sul-sudoeste na Barra
// da Lagoa (canto virado pra nordeste) e pro sul-sudoeste no Matadeiro. Os guias de surf apontam o sul
// como vento bom na Barra, e o Waves classificou o sul de lá como terral. Usado também pelo texto de
// análise (surfData.ts), pra frase e nota tratarem o sul igual.
export const southWindHits = (windDir: string, beachOrientation: number) =>
  SOUTH_WINDS.has(windDir) && classifyWind(windDir, beachOrientation) !== 'offshore'
// Curva ditada pelo usuário (30/set/2026, 2ª rodada): 10 km/h −1 · 15 −1,5 · 20 −2,5 · 25 −3,5
// "e assim vai" (mais −1 a cada 5 km/h) — com sul de 21 km/h o mar "não fica nem regular"
// 01/out/2026 (3ª rodada): "swell bom com sul de 20 km/h no Campeche fica extremamente ruim — não
// tem formação, o mar fica mexido, a onda se despedaça" e "com sul de mais de 17 km/h a nota continua
// 5,3". Curva endurecida pra que, numa praia exposta, sul de 20 km/h derrube até um swell bom
// (1,2 m, 10 s) pra RUIM e sul de ~17 km/h derrube um mar médio pra RUIM. Praias protegidas do sul
// usam a velocidade reduzida (southExposure).
// 09/out/2026 (5ª rodada, ditada pelo usuário ao ver 13 km/h tirar 2,2): "10 km/h tira 1; de 11 a 14
// tira 1,1 a 1,7; de 15 a 20 tira 1,8 a 2,5, e assim vai" (mesmo ritmo depois de 20). Desfaz o
// endurecimento de 01/out (15 km/h −3, 20 km/h −5,5): um swell bom (1,2 m, 10 s) com sul de 20 km/h
// numa praia exposta volta a ficar BOM (6,7), não RUIM.
const WIND_SOUTH: [number, number][] = [[3, 1.0], [5, 0], [10, -1.0], [11, -1.1], [14, -1.7], [15, -1.8], [20, -2.5], [25, -3.2], [30, -3.9]]
// Os outros ventos não estragam muito o mar antes de uns 15 km/h (nem o maral: até 10 km/h
// não desconta nada). Terral segura a onda em pé até ficar forte; lateral fica no meio.
const WIND_OFFSHORE: [number, number][] = [[3, 1.5], [5, 1.2], [10, 1.2], [15, 1.0], [20, -0.4], [25, -1.0]]
const WIND_LATERAL: [number, number][] = [[5, 1.3], [10, 1.0], [15, -0.5], [20, -1.0], [25, -1.5]]
const WIND_ONSHORE: [number, number][] = [[3, 1.0], [10, 0], [15, -0.8], [20, -2.3], [25, -3.0]]
// Período médio do swell, tabela do usuário. Acima de 11 s quase não acontece em Floripa (0% em
// 30 dias de dado real), por isso o bônus máximo fica em 11 s
const PERIOD: [number, number][] = [[5, -1.2], [6, -0.7], [7, 0.2], [8, 0.7], [9, 1.0], [10, 1.2], [11, 1.4]]

function interpolate(points: [number, number][], x: number): number {
  if (!Number.isFinite(x) || x <= points[0][0]) return points[0][1]
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i]
    if (x <= x1) {
      const [x0, y0] = points[i - 1]
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
    }
  }
  return points[points.length - 1][1]
}

// Cada parte já arredondada a 1 casa: a tela que explica a nota (ScoreExplainer) mostra as
// partes com 1 casa, e a soma delas tem que bater com o total
const round1 = (n: number) => Math.round(n * 10) / 10 + 0

export function calculateSurfScore(
  waveHeight: number,
  windSpeed: number,
  swellPeriod: number,
  windDir: string,
  beachOrientation: number,
  southExposure = 1,
): number {
  return explainSurfScore(waveHeight, windSpeed, swellPeriod, windDir, beachOrientation, southExposure).total
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
