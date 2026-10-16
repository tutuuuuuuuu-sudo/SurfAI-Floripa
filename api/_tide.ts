// Busca de maré (Open-Meteo Marine) — fonte única usada por tide.ts (maré "agora") e
// forecast-day.ts (maré de um dia específico da previsão de 14 dias).
// Prefixo _ indica que não é um handler HTTP — não será exposto como endpoint pelo Vercel.

// pastDays (09/out/2026): dias pra trás, pra saber a maré na hora de uma sessão já surfada
export async function fetchTideData(days: number = 2, pastDays: number = 0): Promise<{ heights: number[]; times: string[] } | null> {
  try {
    const res = await fetch(
      'https://marine-api.open-meteo.com/v1/marine?' +
      'latitude=-27.62&longitude=-48.48' +
      '&hourly=sea_level_height_msl' +
      `&timezone=America%2FSao_Paulo&forecast_days=${days}` + (pastDays > 0 ? `&past_days=${pastDays}` : ''),
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const data = await res.json() as {
      error?: string
      hourly?: { sea_level_height_msl: number[]; time: string[] }
    }
    if (data.error || !data.hourly?.sea_level_height_msl) return null
    return { heights: data.hourly.sea_level_height_msl, times: data.hourly.time }
  } catch { return null }
}
