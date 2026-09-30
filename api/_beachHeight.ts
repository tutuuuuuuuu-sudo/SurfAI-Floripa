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

// Duas casas: quem mostra arredonda pra uma (faixa, cards); o cálculo da faixa e da nota usa
// o valor sem perder precisão no meio do caminho
export function toBeachHeight(openSeaHeight: number, swellPeriod: number): number {
  return Math.round(openSeaHeight * beachHeightFactor(swellPeriod) * 100) / 100
}
