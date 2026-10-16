// Utilitário de data/hora no fuso de Florianópolis (America/Sao_Paulo), compartilhado
// entre client (src/) e serverless edge functions (api/, que roda em UTC por padrão).

export function todaySP(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

export function nowHourSP(): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date())
  )
}
