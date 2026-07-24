// Lógica de score de surf — fonte única de verdade para todas as APIs do backend.
// Prefixo _ indica que não é um handler HTTP — não será exposto como endpoint pelo Vercel.

export const WIND_DEG: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
  E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
  W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
}

export function calculateSurfScore(
  waveHeight: number,
  windSpeed: number,
  swellPeriod: number,
  windDir: string,
  beachOrientation: number
): number {
  // Base de score pela altura da onda
  let waveBase: number
  if (waveHeight >= 2.5) waveBase = 10
  else if (waveHeight >= 2.0) waveBase = 9.5
  else if (waveHeight >= 1.5) waveBase = 9.0
  else if (waveHeight >= 1.2) waveBase = 8.5
  else if (waveHeight >= 1.0) waveBase = 8.0
  else if (waveHeight >= 0.8) waveBase = 7.5
  else if (waveHeight >= 0.6) waveBase = 7.0
  else if (waveHeight >= 0.5) waveBase = 6.5
  else if (waveHeight >= 0.4) waveBase = 5.5
  else waveBase = 4.0

  // Penalização pelo vento considerando a orientação da praia
  const offshoreDir = (beachOrientation + 180) % 360
  let angleDiff = Math.abs((WIND_DEG[windDir] ?? 0) - offshoreDir)
  if (angleDiff > 180) angleDiff = 360 - angleDiff

  let windPenalty: number
  if (angleDiff <= 45) {
    // Offshore — vento saindo do mar, deixa ondas limpas
    windPenalty = windSpeed <= 10 ? 0 : windSpeed <= 15 ? -0.3 : windSpeed <= 20 ? -0.8 : -1.5
  } else if (angleDiff <= 90) {
    // Lateral
    windPenalty = windSpeed <= 10 ? -0.5 : windSpeed <= 15 ? -1.0 : windSpeed <= 20 ? -1.8 : -2.5
  } else {
    // Onshore — vento bagunçando as ondas
    windPenalty = windSpeed <= 10 ? -1.0 : windSpeed <= 15 ? -2.0 : windSpeed <= 20 ? -3.0 : -4.0
  }

  // Ajuste pelo período do swell
  let periodAdjust: number
  if (swellPeriod >= 16) periodAdjust = 0.5
  else if (swellPeriod >= 14) periodAdjust = 0.3
  else if (swellPeriod >= 12) periodAdjust = 0.2
  else if (swellPeriod >= 10) periodAdjust = 0
  else if (swellPeriod >= 8) periodAdjust = -0.2
  else if (swellPeriod >= 7) periodAdjust = -0.4
  else periodAdjust = -0.6

  return Math.min(10, Math.max(1, Number((waveBase + windPenalty + periodAdjust).toFixed(1))))
}

// Corrige a altura de onda "crua" do modelo de oceano aberto pela exposição direcional
// da praia: swell alinhado com a praia (mesma direção de `beachOrientation`) chega quase
// sem perda; swell de lado perde energia por refração/difração que o modelo pontual não
// capta. Não substitui calibração local (camada 3) — só corrige o desalinhamento angular.
export function applyDirectionalExposure(
  waveHeight: number,
  swellDir: string,
  beachOrientation: number
): number {
  const swellDeg = WIND_DEG[swellDir]
  if (swellDeg === undefined) return waveHeight

  let angleDiff = Math.abs(swellDeg - beachOrientation)
  if (angleDiff > 180) angleDiff = 360 - angleDiff

  const exposureFactor = Math.max(0.55, Math.cos((angleDiff * Math.PI) / 180))
  return Number((waveHeight * exposureFactor).toFixed(1))
}
