// Regras e textos dos lembretes de fim de plano/teste grátis (02/out/2026) — usados pelo robô
// api/plan-reminders.ts. Separado do handler pra dar pra testar sem rede. Prefixo _ indica que
// não é um handler HTTP — não será exposto como endpoint pelo Vercel.
//
// Quando: faltando ~5 dias, faltando 1 dia e no dia em que acabou (ideia do usuário: avisar com
// 5 dias e de novo com 1-2 dias; o "acabou" é o convite pra voltar). O plano pago hoje é
// pagamento único (não renova sozinho), por isso o aviso.

import { PRICE_MONTHLY, PRICE_ANNUAL_PER_MONTH, formatBRL } from '../src/lib/pricing.js'

export type ReminderKind = 'd5' | 'd1' | 'ended'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** Qual aviso cabe agora pra um plano que vence em expiresAt (null = nenhum). */
export function reminderKind(expiresAt: string, now: number): ReminderKind | null {
  const left = new Date(expiresAt).getTime() - now
  if (left <= 0) return left > -2 * DAY ? 'ended' : null
  if (left <= DAY) return 'd1'
  if (left <= 5 * DAY) return 'd5'
  return null
}

// Data no fuso de Brasília (UTC-3 fixo, sem horário de verão desde 2019)
function brtDate(ms: number): Date {
  return new Date(ms - 3 * HOUR)
}
function brtDayNumber(ms: number): number {
  return Math.floor((ms - 3 * HOUR) / DAY)
}

/** "02/10" no horário de Brasília */
export function formatDayMonth(iso: string): string {
  const d = brtDate(new Date(iso).getTime())
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** "hoje", "amanhã" ou "em 5 dias", contando dias do calendário de Brasília */
export function whenPhrase(expiresAt: string, now: number): string {
  const days = brtDayNumber(new Date(expiresAt).getTime()) - brtDayNumber(now)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'amanhã'
  return `em ${days} dias`
}

export interface ReminderInput {
  kind: ReminderKind
  plan: string          // 'trial' | 'monthly' | 'annual'
  expiresAt: string
  firstName: string     // já escapado pra HTML
  now: number
}

export interface ReminderMessage {
  subject: string
  preview: string       // texto escondido que aparece na lista de e-mails
  title: string
  paragraphs: string[]
  cta: string
  pushTitle: string
  pushBody: string
}

const PRICES = `${formatBRL(PRICE_MONTHLY)} por mês ou ${formatBRL(PRICE_ANNUAL_PER_MONTH)} por mês no plano anual`

export function buildReminderMessage({ kind, plan, expiresAt, firstName, now }: ReminderInput): ReminderMessage {
  const date = formatDayMonth(expiresAt)
  const when = whenPhrase(expiresAt, now)
  const trial = plan === 'trial'
  const planName = plan === 'annual' ? 'anual' : 'mensal'

  if (trial) {
    if (kind === 'd5') return {
      subject: `Seu teste do Premium acaba ${when}`,
      preview: `Até ${date} você segue com tudo liberado.`,
      title: `${firstName}, seu teste grátis acaba ${when}`,
      paragraphs: [
        `Até ${date} você continua com a previsão de 14 dias, os alertas de mar bom e o chat com o Surf AI.`,
        `Se quiser seguir com tudo depois disso, é só assinar pelo app: ${PRICES}. Os dias que sobrarem do teste somam no plano, você não perde nada assinando antes.`,
      ],
      cta: 'Ver os planos',
      pushTitle: `Seu teste grátis acaba ${when}`,
      pushBody: `Até ${date} está tudo liberado. Toque pra ver os planos.`,
    }
    if (kind === 'd1') return {
      subject: `Seu teste do Premium acaba ${when}`,
      preview: 'Depois disso a conta volta pro plano grátis.',
      title: `Seu teste grátis acaba ${when}`,
      paragraphs: [
        `${when === 'hoje' ? 'Hoje' : 'Amanhã'} (${date}) sua conta volta pro plano grátis. A nota das 14 praias e os 3 dias de previsão continuam, mas a previsão de 14 dias, os alertas e o chat com o Surf AI saem.`,
        `Pra continuar com tudo, assine pelo app: ${PRICES}.`,
      ],
      cta: 'Continuar com o Premium',
      pushTitle: `Seu teste grátis acaba ${when}`,
      pushBody: 'Pra não perder os alertas e a previsão de 14 dias, toque pra assinar.',
    }
    return {
      subject: 'Seu teste do Premium acabou',
      preview: 'Valeu por testar. Dá pra voltar quando quiser.',
      title: `Valeu por testar, ${firstName}`,
      paragraphs: [
        'Seu teste grátis acabou e a conta voltou pro plano grátis: a nota das 14 praias e os 3 dias de previsão continuam lá.',
        `Se sentir falta dos alertas, da previsão de 14 dias ou do chat, o Premium está a um toque: ${PRICES}.`,
      ],
      cta: 'Assinar o Premium',
      pushTitle: 'Seu teste do Premium acabou',
      pushBody: 'A conta voltou pro plano grátis. Toque pra assinar e ter tudo de volta.',
    }
  }

  if (kind === 'd5') return {
    subject: `Seu Premium acaba ${when}`,
    preview: `Seu plano ${planName} vai até ${date}.`,
    title: `${firstName}, seu Premium acaba ${when}`,
    paragraphs: [
      `Seu plano ${planName} vai até ${date}. Ele não renova sozinho, então se quiser continuar é só renovar pelo app.`,
      'Pode renovar antes sem medo: os dias que ainda faltam continuam valendo e o plano novo começa depois deles.',
    ],
    cta: 'Renovar o Premium',
    pushTitle: `Seu Premium acaba ${when}`,
    pushBody: `Vai até ${date}. Toque pra renovar, os dias que faltam continuam valendo.`,
  }
  if (kind === 'd1') return {
    subject: `Seu Premium acaba ${when}`,
    preview: 'Renove pra não ficar sem os alertas.',
    title: `Seu Premium acaba ${when}`,
    paragraphs: [
      `${when === 'hoje' ? 'Hoje' : 'Amanhã'} (${date}) sua conta volta pro plano grátis e saem a previsão de 14 dias, os alertas de mar bom e o chat com o Surf AI.`,
      `Pra continuar com tudo, renove pelo app: ${PRICES}.`,
    ],
    cta: 'Renovar o Premium',
    pushTitle: `Seu Premium acaba ${when}`,
    pushBody: 'Toque pra renovar e não ficar sem os alertas.',
  }
  return {
    subject: 'Seu Premium acabou',
    preview: 'A conta voltou pro plano grátis. Dá pra renovar quando quiser.',
    title: `Seu Premium acabou, ${firstName}`,
    paragraphs: [
      'Sua conta voltou pro plano grátis: a nota das 14 praias e os 3 dias de previsão continuam lá.',
      `Quando quiser os alertas, a previsão de 14 dias e o chat de volta, é só renovar: ${PRICES}.`,
    ],
    cta: 'Renovar o Premium',
    pushTitle: 'Seu Premium acabou',
    pushBody: 'A conta voltou pro plano grátis. Toque pra renovar.',
  }
}

// Mesmo visual do e-mail de boas-vindas (api/email-welcome.ts): tabela + estilo inline, porque
// cliente de e-mail não lê o CSS do app.
export function buildReminderHtml(msg: ReminderMessage, appUrl: string): string {
  const bg = '#0b1117', card = '#121a22', line = '#1f2a35', text = '#e6edf3', muted = '#9aa7b2', accent = '#14a3b0'
  const paragraphs = msg.paragraphs
    // "R$" e o valor nunca em linhas separadas
    .map(p => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${muted}">${p.replace(/R\$ /g, () => 'R$&nbsp;')}</p>`)
    .join('')
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${bg}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${msg.preview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg}">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Arial,Helvetica,sans-serif;color:${text}">
        <tr><td style="padding:8px 4px 20px">
          <div style="font-size:13px;font-weight:700;letter-spacing:2px;color:${accent}">SURF AI FLORIPA</div>
        </td></tr>
        <tr><td style="background:${card};border:1px solid ${line};border-radius:16px;padding:28px 24px">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${text}">${msg.title}</h1>
          ${paragraphs}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 0"><tr><td style="background:${accent};border-radius:12px">
            <a href="${appUrl}/premium" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">${msg.cta}</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:24px 4px 8px;font-size:13px;line-height:1.6;color:${muted}">
          Qualquer dúvida, é só responder este e-mail.<br>
          Surf AI Floripa · Florianópolis, SC · <a href="${appUrl}/privacy" style="color:${muted}">Privacidade</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
