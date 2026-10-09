// Altura de onda NA PRAIA a partir da altura de mar aberto do modelo (30/set/2026).
// Prefixo _ = não exposto como endpoint HTTP pelo Vercel.
//
// O ECMWF WAM (o mesmo modelo que o Windy mostra) dá a altura significativa de mar aberto, numa
// grade de ~28 km. Onda de período curto (mar de vento) perde força antes de quebrar e chega bem
// menor na praia; swell longo chega do tamanho previsto. Os dois dias que definiram o fator:
// - 30/set/2026, mar de 6 s: modelo 1,44 m no Campeche; o usuário (surfista local, mora no
//   Campeche) viu série de 1 m, Surfline mostrava 0,9-1,2 m e o Windy 1,5 m (= modelo cru).
// - 24/set/2026, swell de 10-11 s: modelo 1,56 m e séries de quase 2 m — o modelo acertou.
// Com só dois dias o fator é provisório: vai ser recalibrado com mais observações (memória
// project-wave-height-calibration). Na dúvida fica mais baixo — o usuário prefere nunca mostrar
// mar maior que o real (onda exagerada frustra quem vai pra praia) — por isso não passa de 1,0.
//
// Aplicado na fonte (_liveConditions.ts pro "agora" e _hourlyForecast.ts pra previsão): tudo que
// mostra altura ou calcula nota em cima dela (telas, chat, alertas, histórico) herda daqui.

// [período médio do swell em s, fator]; entre dois pontos anda em linha reta, fora deles vale a ponta
const PERIOD_FACTOR: [number, number][] = [[5, 0.62], [6, 0.70], [7, 0.78], [8, 0.86], [9, 0.93], [10, 1.0]]

export function beachHeightFactor(swellPeriod: number): number {
  if (!Number.isFinite(swellPeriod) || swellPeriod <= 0) return 1 // sem período confiável, não mexe
  if (swellPeriod <= PERIOD_FACTOR[0][0]) return PERIOD_FACTOR[0][1]
  for (let i = 1; i < PERIOD_FACTOR.length; i++) {
    const [x1, y1] = PERIOD_FACTOR[i]
    if (swellPeriod <= x1) {
      const [x0, y0] = PERIOD_FACTOR[i - 1]
      return y0 + ((swellPeriod - x0) / (x1 - x0)) * (y1 - y0)
    }
  }
  return PERIOD_FACTOR[PERIOD_FACTOR.length - 1][1]
}

// 01/out/2026 — base passou a ser o modelo da Météo-France (o "modelo padrão" do Open-Meteo pra
// Floripa, grade ~8 km, enxerga a proteção da costa), não mais o ECMWF de mar aberto (~28 km).
// Observações reais que decidiram (mesma hora das duas fontes):
// - 01/out 6h30, boletim.surf: Morro das Pedras e Armação 0,5-0,6 m; francês 0,7; ECMWF 1,5/1,2
// - 30/set ~11h, usuário no Campeche: série 1 m (0,8-1,2); francês 1,04; ECMWF 1,48
// - 24/set, usuário no Campeche: séries ~2 m, intermediárias 1-1,5; francês 1,02-1,22; ECMWF 1,56
// O francês erra pra baixo em ONDULAÇÃO LONGA (24/set): onda longa cresce ao chegar no raso e ele
// não pega isso inteiro. Acréscimo a partir de 8 s, chegando a +30% em 10 s ou mais — a física
// (empinamento, ~(T/8)^0,4) dá uns 15-25%; 30% cobre o resto sem passar do real, porque parte da
// diferença de 24/set era o usuário contando as séries. Começa conservador e vai ser recalibrado
// pelo registro do mar real (tabela sea_observations).
// Teto: nunca passa da conta antiga (ECMWF × fator do período) — nunca mostra mais que antes.
const LONG_PERIOD_BOOST: [number, number][] = [[8, 1.0], [10, 1.3]]

function interp(points: [number, number][], x: number): number {
  if (x <= points[0][0]) return points[0][1]
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i]
    if (x <= x1) {
      const [x0, y0] = points[i - 1]
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
    }
  }
  return points[points.length - 1][1]
}

export function longPeriodBoost(swellPeriod: number): number {
  return Number.isFinite(swellPeriod) && swellPeriod > 0 ? interp(LONG_PERIOD_BOOST, swellPeriod) : 1
}

// Duas casas: quem mostra arredonda pra uma (faixa, cards); o cálculo da faixa e da nota usa
// o valor sem perder precisão no meio do caminho.
// - com as duas alturas: a menor entre francês × acréscimo de onda longa e mar aberto × fator
// - só a do francês: francês × acréscimo
// - só a de mar aberto (fontes reserva, ou dia sem o francês): mar aberto × fator do período
export function toBeachHeight(openSeaHeight: number | null | undefined, swellPeriod: number, nearshoreHeight?: number | null): number {
  const ok = (h: number | null | undefined): h is number => h != null && Number.isFinite(h) && h > 0
  const options: number[] = []
  if (ok(openSeaHeight)) options.push(openSeaHeight * beachHeightFactor(swellPeriod))
  if (ok(nearshoreHeight)) options.push(nearshoreHeight * longPeriodBoost(swellPeriod))
  return options.length ? Math.round(Math.min(...options) * 100) / 100 : 0
}

// 09/out/2026 — o modelo francês só vai até ~8,5 dias; o ECMWF vai até os 14 da previsão Premium.
// Do 9º dia em diante a previsão vinha sem período e sem altura do francês, e o código caía no
// período reserva de 10 s (fator 1,0 = mar aberto inteiro na praia): Campeche com 2,8 m e nota 10
// cinco dias seguidos, 18-22/out. O usuário viu no app e perguntou no chat.
// Nesses dias a altura e o período passam a vir do ECMWF, ajustados pela diferença que os dois
// modelos têm nos dias em que existem juntos (mesma praia, mesma resposta). Medido em 09/out nas
// 14 praias: altura na praia = 0,51 a 0,70 × ECMWF, período de swell do francês = período médio do
// ECMWF menos 1,2 a 1,8 s. Teste: calibrando só com os dias 0-4 e conferindo nos dias 5-8, a onda
// ficou ×1,02 da que o app mostra com o francês e a nota −0,1 em média (só 1% das horas mais de
// 1 ponto acima). Sem horas em comum suficientes, vale o lado baixo da medição.
export interface OpenSeaCalibration { heightRatio: number; periodOffset: number }

const MIN_CALIBRATION_HOURS = 24
export const DEFAULT_OPEN_SEA_CALIBRATION: OpenSeaCalibration = { heightRatio: 0.6, periodOffset: -1.5 }

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// Arrays hora a hora da mesma resposta: altura do francês, período de swell do francês, altura e
// período médio do ECMWF
export function calibrateOpenSea(
  nearshoreHeights: (number | null | undefined)[],
  swellPeriods: (number | null | undefined)[],
  openSeaHeights: (number | null | undefined)[],
  openSeaPeriods: (number | null | undefined)[]
): OpenSeaCalibration {
  const ok = (v: number | null | undefined): v is number => v != null && Number.isFinite(v) && v > 0
  const ratios: number[] = [], offsets: number[] = []
  for (let i = 0; i < openSeaHeights.length; i++) {
    const near = nearshoreHeights[i], period = swellPeriods[i], open = openSeaHeights[i], openPeriod = openSeaPeriods[i]
    if (!ok(near) || !ok(period) || !ok(open) || !ok(openPeriod)) continue
    ratios.push(toBeachHeight(open, Math.round(period), near) / open)
    offsets.push(period - openPeriod)
  }
  if (ratios.length < MIN_CALIBRATION_HOURS) return DEFAULT_OPEN_SEA_CALIBRATION
  return { heightRatio: median(ratios), periodOffset: median(offsets) }
}
