// Condição do tempo (sol/nublado/chuva) a partir dos códigos WMO da Open-Meteo
// (https://open-meteo.com/en/docs) — fonte única usada pelo "agora" (surf.ts) e pelo resumo do
// dia da previsão (_dayDetail.ts). Também importado pelo frontend (ForecastDay.tsx) pra
// mostrar o tempo da hora escolhida na curva.
// Prefixo _ indica que não é um handler HTTP — não será exposto como endpoint pelo Vercel.

export interface WeatherCondition {
  code: number
  label: string
  icon: 'sun' | 'cloud-sun' | 'cloud' | 'rain' | 'storm'
}

const isStorm = (code: number) => code === 95 || code === 96 || code === 99
const isRain = (code: number) => code >= 51 && !isStorm(code)
const isOvercast = (code: number) => code === 3 || code === 45 || code === 48

// Agrupado no que importa pro surfista: sol, nublado, chuva ou tempestade.
export function mapWeatherCode(code: number, isDay: boolean): WeatherCondition {
  if (code === 0) return { code, label: isDay ? 'Sol' : 'Céu limpo', icon: 'sun' }
  if (code <= 2) return { code, label: 'Parcialmente nublado', icon: 'cloud-sun' }
  if (isOvercast(code)) return { code, label: 'Nublado', icon: 'cloud' }
  if (isStorm(code)) return { code, label: 'Tempestade', icon: 'storm' }
  if (code >= 51) return { code, label: 'Chuva', icon: 'rain' }
  return { code, label: 'Nublado', icon: 'cloud' }
}

// Resumo do céu de UM dia, olhando só as horas de luz (o "weather_code" diário da Open-Meteo é
// o pior código das 24 h: uma pancada às 3 da manhã virava "Chuva" o dia inteiro).
// Uma ou duas horas de chuva viram "Chuva rápida de manhã/à tarde"; o resto é a maioria das horas.
export function summarizeDaySky(hours: { hour: number; code: number }[]): WeatherCondition | null {
  if (hours.length === 0) return null
  const when = (list: { hour: number }[]) => {
    const morning = list.filter(h => h.hour < 12).length
    return morning * 2 >= list.length ? 'de manhã' : 'à tarde'
  }
  const storm = hours.filter(h => isStorm(h.code))
  const rain = hours.filter(h => isRain(h.code))
  if (storm.length > 0) return { code: storm[0].code, label: `Tempestade ${when(storm)}`, icon: 'storm' }
  if (rain.length >= 3) return { code: rain[0].code, label: rain.length * 2 >= hours.length ? 'Chuva' : `Chuva ${when(rain)}`, icon: 'rain' }
  if (rain.length > 0) return { code: rain[0].code, label: `Chuva rápida ${when(rain)}`, icon: 'rain' }
  const sunny = hours.filter(h => h.code <= 1).length
  const overcast = hours.filter(h => isOvercast(h.code)).length
  if (sunny / hours.length >= 0.6) return { code: 0, label: 'Sol', icon: 'sun' }
  if (overcast / hours.length >= 0.6) return { code: 3, label: 'Nublado', icon: 'cloud' }
  return { code: 2, label: 'Sol entre nuvens', icon: 'cloud-sun' }
}
