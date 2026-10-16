import { describe, it, expect } from 'vitest'
import { reminderKind, whenPhrase, formatDayMonth, buildReminderMessage, buildReminderHtml } from './_planReminders'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
// Robô roda 12h UTC = 9h em Brasília
const NOW = Date.UTC(2026, 9, 2, 12, 0, 0)
const at = (ms: number) => new Date(NOW + ms).toISOString()

describe('reminderKind', () => {
  it('nada com mais de 5 dias pela frente', () => {
    expect(reminderKind(at(5 * DAY + HOUR), NOW)).toBeNull()
    expect(reminderKind(at(30 * DAY), NOW)).toBeNull()
  })
  it('aviso de 5 dias entre 1 e 5 dias', () => {
    expect(reminderKind(at(5 * DAY), NOW)).toBe('d5')
    expect(reminderKind(at(2 * DAY), NOW)).toBe('d5')
  })
  it('aviso de 1 dia nas últimas 24h', () => {
    expect(reminderKind(at(DAY), NOW)).toBe('d1')
    expect(reminderKind(at(3 * HOUR), NOW)).toBe('d1')
  })
  it('"acabou" até 2 dias depois de vencer, depois para', () => {
    expect(reminderKind(at(-HOUR), NOW)).toBe('ended')
    expect(reminderKind(at(-DAY - HOUR), NOW)).toBe('ended')
    expect(reminderKind(at(-3 * DAY), NOW)).toBeNull()
  })
  it('robô diário passa por cada aviso uma vez num teste de 15 dias', () => {
    const expires = new Date(Date.UTC(2026, 9, 2, 14, 30) + 15 * DAY).toISOString()
    const kinds = Array.from({ length: 20 }, (_, d) => reminderKind(expires, NOW + d * DAY)).filter(Boolean)
    // dias 11-14 caem na janela de 5 dias, dia 15 na de 1 dia, dias 16-17 em "acabou" —
    // a tabela plan_reminders garante 1 envio de cada
    expect(new Set(kinds)).toEqual(new Set(['d5', 'd1', 'ended']))
  })
})

describe('datas no horário de Brasília', () => {
  it('hoje / amanhã / em N dias pelo calendário, não por 24h', () => {
    // 23h de Brasília do mesmo dia = 02h UTC do dia seguinte
    expect(whenPhrase(new Date(Date.UTC(2026, 9, 3, 2, 0)).toISOString(), NOW)).toBe('hoje')
    expect(whenPhrase(new Date(Date.UTC(2026, 9, 3, 4, 0)).toISOString(), NOW)).toBe('amanhã')
    expect(whenPhrase(at(5 * DAY), NOW)).toBe('em 5 dias')
  })
  it('dia/mês em Brasília', () => {
    expect(formatDayMonth(new Date(Date.UTC(2026, 9, 3, 2, 0)).toISOString())).toBe('02/10')
  })
})

describe('mensagens', () => {
  const base = { firstName: 'Ana', now: NOW }
  it('teste grátis fala em teste e mostra o preço novo', () => {
    const m = buildReminderMessage({ ...base, kind: 'd5', plan: 'trial', expiresAt: at(5 * DAY) })
    expect(m.subject).toBe('Seu teste do Premium acaba em 5 dias')
    expect(m.paragraphs.join(' ')).toContain('R$ 22,90 por mês ou R$ 16,90 por mês no plano anual')
  })
  it('plano pago avisa que não renova sozinho', () => {
    const m = buildReminderMessage({ ...base, kind: 'd5', plan: 'monthly', expiresAt: at(5 * DAY) })
    expect(m.paragraphs[0]).toContain('não renova sozinho')
    expect(m.cta).toBe('Renovar o Premium')
  })
  it('sem travessão e sem markdown em nenhum texto', () => {
    for (const plan of ['trial', 'monthly', 'annual']) {
      for (const kind of ['d5', 'd1', 'ended'] as const) {
        const m = buildReminderMessage({ ...base, kind, plan, expiresAt: at(kind === 'ended' ? -HOUR : kind === 'd1' ? 3 * HOUR : 4 * DAY) })
        const all = [m.subject, m.preview, m.title, ...m.paragraphs, m.cta, m.pushTitle, m.pushBody].join(' ')
        expect(all).not.toMatch(/[—–*]/)
      }
    }
  })
  it('HTML leva o botão pra página do Premium', () => {
    const m = buildReminderMessage({ ...base, kind: 'd1', plan: 'trial', expiresAt: at(3 * HOUR) })
    const html = buildReminderHtml(m, 'https://www.surfaifloripa.com.br')
    expect(html).toContain('href="https://www.surfaifloripa.com.br/premium"')
    expect(html).toContain(m.title)
  })
  it('preço não quebra linha no e-mail (e o "$&" do replace não estraga o texto)', () => {
    const m = buildReminderMessage({ ...base, kind: 'd1', plan: 'trial', expiresAt: at(3 * HOUR) })
    const html = buildReminderHtml(m, 'https://www.surfaifloripa.com.br')
    expect(html).toContain('R$&nbsp;22,90')
    expect(html).not.toContain('RR$')
  })
})
