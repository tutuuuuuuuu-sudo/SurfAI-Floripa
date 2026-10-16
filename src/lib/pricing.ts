// Preço do Premium e do teste grátis — fonte única, sem imports, pra poder ser usada tanto
// pelo app (Premium.tsx, Landing.tsx, Terms.tsx...) quanto pelos endpoints de servidor
// (create-payment.ts, email-welcome.ts, daily-report.ts, plan-reminders.ts). Antes o
// valor estava escrito à mão em 19 lugares.
//
// Preço de 02/out/2026 (decisão do usuário): mensal R$ 22,90 e anual R$ 16,90/mês
// (R$ 202,80 cobrado uma vez por ano). Referência: Surfguru PRO R$ 20/mês e R$ 16/mês
// no anual (R$ 192/ano). Antes: R$ 16,90 e R$ 149,90.

export const PRICE_MONTHLY = 22.90
export const PRICE_ANNUAL = 202.80
export const PRICE_ANNUAL_PER_MONTH = 16.90

export const PLAN_DAYS = { monthly: 30, annual: 365 } as const

// Teste grátis: 15 dias, sem cartão, uma vez por conta (start_trial no banco).
// 15 e não 7 porque o Premium mostra valor quando entra uma ondulação boa (alerta chega,
// mar estava bom mesmo) — em 7 dias pode cair uma semana de mar flat.
export const TRIAL_DAYS = 15

// Parcelas do anual pago dentro do app (OneTimePaymentForm + api/_mpDirectPayment.ts). Até 12x
// desde 08/out/2026 (decisão do usuário): "parcelado comprador", o padrão do Mercado Pago — quem
// paga os juros é o cliente e o app recebe o valor cheio de uma vez, menos a taxa normal do cartão.
// Pra oferecer "sem juros" (o app paga a taxa do parcelamento) é no painel do Mercado Pago.
export const ANNUAL_MAX_INSTALLMENTS = 12

/** 22.9 → "R$ 22,90" */
export function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

/** Quanto o anual economiza em relação a 12 meses do mensal, em reais inteiros (R$ 72).
 *  Arredonda no centavo antes: 22.9 * 12 - 202.8 dá 71.99999… em ponto flutuante. */
export const ANNUAL_SAVINGS = Math.floor(Math.round((PRICE_MONTHLY * 12 - PRICE_ANNUAL) * 100) / 100)

/** "menos de R$ 0,56/dia" — sempre arredonda pra cima no centavo, pra frase ser verdadeira. */
export function perDayCeil(total: number, days: number): string {
  return formatBRL(Math.ceil((total / days) * 100) / 100)
}
