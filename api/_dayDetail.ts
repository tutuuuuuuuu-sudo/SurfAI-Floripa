// Detalhe hora a hora de UM dia da previsão (onda, vento, nota, sol, maré) — fonte única
// usada por forecast-day.ts (página do dia, com login) e landing-day.ts (demonstração da
// curva do dia na landing, sem login). Extraído de forecast-day.ts em 28/set/2026 pra a
// landing não precisar de uma segunda cópia dessa lógica.
// Prefixo _ indica que não é um handler HTTP — não será exposto como endpoint pelo Vercel.
import { fetchHourlyForecast, type HourReading } from './_hourlyForecast.js'
import { fetchTideData } from './_tide.js'
import { summarizeDaySky, type WeatherCondition } from './_weatherCode.js'

// Mesma janela "surfável" usada em forecast.ts pra escolher a melhor hora do dia — evita
// cravar o resumo com base numa hora de madrugada que ninguém vai encarar.
const DAY_START_HOUR = 5
const DAY_END_HOUR = 20

export interface DayDetail {
  date: string
  dayName: string
  dayIndex: number
  hours: (HourReading & { hour: number })[]
  best: HourReading & { hour: number }
  sunriseHour: number | null
  sunsetHour: number | null
  tideHeights: number[] | null
  // Tempo do dia (01/out/2026, pedido do usuário): céu nas horas de luz, temperatura do ar
  // (mín/máx do dia), chance de chuva (maior das horas de luz) e água (média das horas de luz;
  // null além de ~10 dias, onde a Open-Meteo não tem previsão da água)
  weather: {
    sky: WeatherCondition | null
    airMin: number
    airMax: number
    rainChance: number | null
    waterTemp: number | null
  }
}

export async function buildDayDetail(lat: string, lng: string, orientation: number, dayIndex: number): Promise<DayDetail | null> {
  // Maré em paralelo com o forecast de onda/vento — são fontes independentes, não precisa
  // esperar uma pra pedir a outra. Maré é astronômica (sol/lua), não depende do tempo como
  // onda/vento, então o Open-Meteo prevê com confiança bem além de 14 dias (testado ao vivo
  // em 24/set/2026: retorna dado consistente até pelo menos 16 dias à frente).
  const [hourly, tide] = await Promise.all([
    fetchHourlyForecast(lat, lng, dayIndex + 1),
    fetchTideData(dayIndex + 1),
  ])
  if (!hourly) return null

  const startIdx = dayIndex * 24
  if (startIdx >= hourly.times.length) return null

  const date = hourly.times[startIdx].slice(0, 10)
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const dateObj = new Date(date + 'T12:00:00')
  const dayName = dayIndex === 0 ? 'Hoje' : dayIndex === 1 ? 'Amanhã' : dayNames[dateObj.getDay()]

  const hours: (HourReading & { hour: number })[] = []
  for (let h = 0; h < 24; h++) {
    const idx = startIdx + h
    if (idx >= hourly.times.length) break
    const reading = hourly.readHour(idx, orientation)
    if (reading) hours.push({ hour: h, ...reading })
  }
  if (hours.length === 0) return null

  // Nascer/pôr do sol do próprio dia (antes usava o de hoje pra qualquer dia da previsão)
  const { sunriseHour, sunsetHour } = hourly.sunFor(dayIndex)
  const daylight = hours.filter(h => h.hour >= (sunriseHour ?? 6) && h.hour <= (sunsetHour ?? 18))
  const light = daylight.length > 0 ? daylight : hours
  const codes = light.filter(h => h.weatherCode != null).map(h => ({ hour: h.hour, code: h.weatherCode! }))
  const rain = light.map(h => h.rainChance).filter((v): v is number => v != null)
  const water = light.map(h => h.waterTemp).filter((v): v is number => v != null)
  const air = hours.map(h => h.temperature)
  const weather = {
    sky: summarizeDaySky(codes),
    airMin: Math.min(...air),
    airMax: Math.max(...air),
    rainChance: rain.length > 0 ? Math.max(...rain) : null,
    waterTemp: water.length > 0 ? Math.round(water.reduce((a, b) => a + b, 0) / water.length) : null,
  }

  // Melhor hora dentro da janela surfável, mesmo critério de forecast.ts — onda/vento/
  // período sempre vêm do mesmo horário, nunca de picos independentes.
  const surfableHours = hours.filter(h => h.hour >= DAY_START_HOUR && h.hour <= DAY_END_HOUR)
  const best = (surfableHours.length > 0 ? surfableHours : hours)
    .reduce((a, b) => (b.score > a.score ? b : a))

  // Recorta só as horas de maré que batem com a data desse dia — casa por string de data
  // em vez de confiar em dayIndex*24 puro, pra não desalinhar se a resposta da maré algum
  // dia vier com fuso/offset diferente do forecast de onda/vento.
  let tideHeights: number[] | null = null
  if (tide) {
    const dayIndices = tide.times
      .map((t, i) => (t.slice(0, 10) === date ? i : -1))
      .filter(i => i >= 0)
    if (dayIndices.length >= 20) tideHeights = dayIndices.map(i => tide.heights[i])
  }

  return {
    date, dayName, dayIndex,
    hours,
    best,
    sunriseHour,
    sunsetHour,
    tideHeights,
    weather,
  }
}
