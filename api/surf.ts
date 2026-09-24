export const config = { runtime: 'edge' }

import { createRateLimiter } from './_httpUtils.js'
import { fetchLiveConditions } from './_liveConditions.js'

// ── Utilitários ───────────────────────────────────────────────────────────────

function formatTimeBrasilia(isoString: string): string {
  const timePart = isoString.split('T')[1]
  return timePart ? timePart.substring(0, 5) : ''
}

function isValidCoord(lat: string | null, lng: string | null): boolean {
  if (!lat || !lng) return false
  const latN = parseFloat(lat), lngN = parseFloat(lng)
  return !isNaN(latN) && !isNaN(lngN) && latN >= -90 && latN <= 90 && lngN >= -180 && lngN <= 180
}

// ── Condição do tempo (sol/nublado/chuva) ──────────────────────────────────────

export interface WeatherCondition {
  code: number
  label: string
  icon: 'sun' | 'cloud-sun' | 'cloud' | 'rain' | 'storm'
}

function mapWeatherCode(code: number, isDay: boolean): WeatherCondition {
  // Códigos WMO da Open-Meteo (https://open-meteo.com/en/docs) agrupados no que
  // importa pro surfista: sol, nublado, chuva ou tempestade.
  if (code === 0) return { code, label: isDay ? 'Sol' : 'Céu limpo', icon: 'sun' }
  if (code <= 2) return { code, label: 'Parcialmente nublado', icon: 'cloud-sun' }
  if (code === 3 || code === 45 || code === 48) return { code, label: 'Nublado', icon: 'cloud' }
  if ([95, 96, 99].includes(code)) return { code, label: 'Tempestade', icon: 'storm' }
  if (code >= 51) return { code, label: 'Chuva', icon: 'rain' }
  return { code, label: 'Nublado', icon: 'cloud' }
}

async function fetchWeatherCondition(lat: string, lng: string): Promise<WeatherCondition | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=weather_code,is_day`,
      { signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return null
    const data = await res.json() as { current?: { weather_code?: number; is_day?: number } }
    if (data.current?.weather_code == null) return null
    return mapWeatherCode(data.current.weather_code, data.current.is_day !== 0)
  } catch {
    return null
  }
}

// ── Rate limiting simples por IP ──────────────────────────────────────────────
// 30 requisições por IP por janela de 60s
const checkRateLimit = createRateLimiter(30)

// ── Handler principal ─────────────────────────────────────────────────────────

export default async function handler(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
    })
  }

  const url = new URL(req.url)
  const lat = url.searchParams.get('lat')
  const lng = url.searchParams.get('lng')

  if (!isValidCoord(lat, lng)) {
    return new Response(JSON.stringify({ error: 'lat/lng inválidos' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const allowedOrigin = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'
  const corsHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowedOrigin }

  try {
    // fetchLiveConditions faz a cascade (Windy → Open-Meteo → Stormglass, ver
    // _liveConditions.ts) — mesma fonte usada por hourly.ts pro slot "agora", pra nunca
    // mais divergir da nota principal (achado 24/ago/2026: Home mostrava 7.0 com Windy
    // enquanto a Melhor Janela do Dia mostrava 5.8 com Open-Meteo, pra mesma praia no
    // mesmo instante). Condição do tempo é buscada em paralelo, independente de qual fonte
    // de onda/vento ganhar a cascade (Windy não retorna weather_code) — se falhar,
    // weatherCondition fica null e o frontend simplesmente não mostra o badge.
    const [result, weatherCondition] = await Promise.all([
      fetchLiveConditions(lat!, lng!),
      fetchWeatherCondition(lat!, lng!),
    ])

    if (!result) {
      return new Response(JSON.stringify({ error: 'Nenhuma fonte disponível' }), { status: 503, headers: corsHeaders })
    }

    // Sunrise/sunset vem junto com fetchOpenMeteo quando ela é a fonte escolhida
    let sunrise = result.sunrise ?? '', sunset = result.sunset ?? ''
    if (!sunrise || !sunset) {
      try {
        const sunRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=sunrise,sunset&wind_speed_unit=kmh&timezone=America%2FSao_Paulo`, { signal: AbortSignal.timeout(5000) })
        const sunData = await sunRes.json() as { daily?: { sunrise?: string[]; sunset?: string[] } }
        sunrise = formatTimeBrasilia(sunData.daily?.sunrise?.[0] ?? '')
        sunset = formatTimeBrasilia(sunData.daily?.sunset?.[0] ?? '')
      } catch { /* sunrise/sunset não crítico */ }
    }

    // Achado 24/set/2026: comparamos as 14 praias contra Surf-Forecast/Waves.com.br/
    // Surfguru no mesmo instante — o valor CRU do ecmwf_wam já batia de perto com os
    // concorrentes quase toda praia; era a applyDirectionalExposure() (calibrada quando
    // a fonte de dado ainda era ruim, antes de 28/ago) que estava cortando 40-70% da
    // altura sem motivo, principalmente nas praias viradas mais pro Norte/Nordeste
    // (Moçambique, Barra da Lagoa, Santinho chegavam a mostrar menos da metade do real).
    // Removida daqui — não substituída por outra fórmula geométrica. Onde existe abrigo
    // real e comprovado (ex: Canal da Barra, ver `exposicao: 0.65` em BEACHES em
    // surfData.ts), o ajuste já vive no sistema de SUB-PICO (getSubRegionMatch), que é
    // específico daquele pico, não da praia inteira — não duplicar aqui.
    return new Response(JSON.stringify({
      waveHeight: result.waveHeight,
      swellPeriod: result.swellPeriod,
      swellDirection: result.swellDirection,
      windSpeed: result.windSpeed,
      windDirection: result.windDir,
      waterTemperature: result.waterTemperature,
      sunrise,
      sunset,
      weatherCondition,
    }), { headers: corsHeaders })
  } catch {
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500, headers: corsHeaders })
  }
}
