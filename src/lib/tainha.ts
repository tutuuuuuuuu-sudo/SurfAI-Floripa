// Temporada de pesca da tainha em Florianópolis: 1° de maio a 31 de julho
// Fonte: regulamentação SEAP/IBAMA

export type TainhaStatus = 'liberada' | 'parcial' | 'fechada' | 'fora-temporada'

export interface TainhaInfo {
  status: TainhaStatus
  message: string
}

// Praias e seus status durante a temporada
const TAINHA_STATUS: Record<string, TainhaStatus> = {
  'joaquina':      'liberada',
  'mole':          'liberada',
  'lagoinha-leste':'parcial',   // até 500m do canto esquerdo
  'matadeiro':     'parcial',   // até 500m do canto esquerdo
  'armacao':       'parcial',   // até 500m do canto esquerdo
  'morro-pedras':  'parcial',   // até 500m do canto direito
  'mocambique':    'parcial',   // até 500m à direita da entrada principal
}

const TAINHA_MESSAGES: Record<TainhaStatus, string> = {
  'liberada':        'Liberada durante a temporada da tainha',
  'parcial':         'Surf permitido em área parcial',
  'fechada':         'Fechada para surf — temporada da tainha',
  'fora-temporada':  '',
}

export function isTainhaSeasonActive(): boolean {
  const now = new Date()
  const month = now.getMonth() + 1 // 1-12
  const day = now.getDate()
  if (month === 5 && day >= 1) return true
  if (month === 6 || month === 7) return true
  return false
}

export function getTainhaInfo(spotId: string): TainhaInfo {
  if (!isTainhaSeasonActive()) {
    return { status: 'fora-temporada', message: '' }
  }

  const status = TAINHA_STATUS[spotId] ?? 'fechada'
  return { status, message: TAINHA_MESSAGES[status] }
}
