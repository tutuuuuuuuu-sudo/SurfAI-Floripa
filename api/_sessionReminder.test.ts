// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { peaksByBeach, pickReminder, buildReminderPush, skipReason, REMINDER_HOUR } from './_sessionReminder'
import { isAlertHour } from './_pushMatch'

// Horários em UTC: 11h UTC = 8h em Florianópolis
const rows = [
  { beach_id: 'campeche', beach_name: 'Campeche', score: '7.70', captured_at: '2026-10-14T11:00:00+00:00' },
  { beach_id: 'campeche', beach_name: 'Campeche', score: '7.10', captured_at: '2026-10-14T13:00:00+00:00' },
  { beach_id: 'campeche', beach_name: 'Campeche', score: '7.70', captured_at: '2026-10-14T15:00:00+00:00' },
  { beach_id: 'santinho', beach_name: 'Santinho', score: '7.20', captured_at: '2026-10-14T12:00:00+00:00' },
  { beach_id: 'joaquina', beach_name: 'Joaquina', score: '5.70', captured_at: '2026-10-14T12:00:00+00:00' },
]

const alert = (min_score: number, favorite_only = false, beach_thresholds: Record<string, number> | null = null) =>
  ({ min_score, favorite_only, beach_thresholds })

describe('peaksByBeach', () => {
  it('pega a melhor hora de cada praia, no horário de Florianópolis, e no empate a mais cedo', () => {
    const peaks = peaksByBeach(rows)
    expect(peaks.find(p => p.beachId === 'campeche')).toEqual({ beachId: 'campeche', beachName: 'Campeche', score: 7.7, hour: 8 })
    expect(peaks.find(p => p.beachId === 'santinho')?.hour).toBe(9)
    expect(peaks).toHaveLength(3)
  })
})

describe('pickReminder', () => {
  const peaks = peaksByBeach(rows)

  it('só pergunta se alguma praia bateu o alerta da pessoa', () => {
    expect(pickReminder(peaks, alert(8), [])).toBeNull()
    expect(pickReminder(peaks, alert(7), [])?.beachId).toBe('campeche')
  })

  it('favorita vem antes de praia com nota maior', () => {
    expect(pickReminder(peaks, alert(7), ['santinho'])?.beachId).toBe('santinho')
  })

  it('respeita "só favoritas" e a nota escolhida por praia', () => {
    expect(pickReminder(peaks, alert(7, true), ['joaquina'])).toBeNull()
    expect(pickReminder(peaks, alert(7, true, { joaquina: 5 }), ['joaquina'])?.beachId).toBe('joaquina')
  })
})

describe('buildReminderPush', () => {
  it('abre o Diário com praia, dia e hora preenchidos', () => {
    const push = buildReminderPush({ beachId: 'campeche', beachName: 'Campeche', score: 7.7, hour: 8 }, '2026-10-14')
    expect(push.title).toBe('Caiu hoje?')
    expect(push.body).toContain('Campeche tava 7.7 às 8h')
    expect(push.url).toBe('/surf-log?registrar=campeche&dia=2026-10-14&hora=8')
  })
})

describe('skipReason', () => {
  const base = { hasSessionToday: false, enabled: true, dismissedOn: null, sentOn: null }
  it('manda quando nada impede', () => {
    expect(skipReason(base, '2026-10-14')).toBeNull()
  })
  it('não manda pra quem desligou, já registrou, tocou "Não caí" hoje ou já recebeu hoje', () => {
    expect(skipReason({ ...base, enabled: false }, '2026-10-14')).toBe('desligado')
    expect(skipReason({ ...base, hasSessionToday: true }, '2026-10-14')).toBe('já registrou')
    expect(skipReason({ ...base, dismissedOn: '2026-10-14' }, '2026-10-14')).toBe('não caiu')
    expect(skipReason({ ...base, sentOn: '2026-10-14' }, '2026-10-14')).toBe('já avisado')
  })
  it('"Não caí" e aviso de ontem não contam hoje', () => {
    expect(skipReason({ ...base, dismissedOn: '2026-10-13', sentOn: '2026-10-13' }, '2026-10-14')).toBeNull()
  })
})

// O "Caiu hoje?" roda dentro do robô de alertas de hora em hora (push-notify.ts): na hora dele não
// pode haver alerta de mar bom, senão o robô teria que fazer os dois
describe('REMINDER_HOUR', () => {
  it('fica fora do horário dos alertas de mar bom', () => {
    expect(isAlertHour(REMINDER_HOUR)).toBe(false)
  })
})
