export const config = { runtime: 'edge' }

// Chamado pelo webhook do Supabase quando um novo usuário se cadastra
// Configurar em: Supabase → Database → Webhooks → auth.users → INSERT

import { PRICE_MONTHLY, PRICE_ANNUAL_PER_MONTH, TRIAL_DAYS, formatBRL } from '../src/lib/pricing.js'

const RESEND_KEY = process.env.RESEND_API_KEY
const APP_URL = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'

// Nome vem do cadastro (texto livre) — escapa antes de colocar no HTML
const escapeHtml = (t: string) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

// Texto reescrito em 01/out/2026: o anterior prometia "relatório diário gerado por IA toda manhã"
// (removido em 23/ago) e usava emoji. Só promete o que a conta grátis tem de fato; Premium entra
// como convite no fim. HTML de e-mail: tabela + estilo inline (cliente de e-mail não lê CSS do app).
export function buildWelcomeHtml(firstName: string): string {
  const bg = '#0b1117', card = '#121a22', line = '#1f2a35', text = '#e6edf3', muted = '#9aa7b2', accent = '#14a3b0'
  const item = (title: string, desc: string) => `
          <tr><td style="padding:0 0 14px">
            <div style="font-size:15px;font-weight:700;color:${text}">${title}</div>
            <div style="font-size:14px;line-height:1.5;color:${muted}">${desc}</div>
          </td></tr>`
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${bg}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">As 14 praias da ilha com nota, onda, vento e maré, hora a hora.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg}">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Arial,Helvetica,sans-serif;color:${text}">
        <tr><td style="padding:8px 4px 20px">
          <div style="font-size:13px;font-weight:700;letter-spacing:2px;color:${accent}">SURF AI FLORIPA</div>
        </td></tr>
        <tr><td style="background:${card};border:1px solid ${line};border-radius:16px;padding:28px 24px">
          <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:${text}">Fala, ${firstName}!</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${muted}">
            Valeu por entrar. Agora você vê como está o mar nas 14 praias da ilha antes de sair de casa, do Santinho ao Naufragados.
          </p>
          <div style="font-size:12px;font-weight:700;letter-spacing:1px;color:${accent};margin:0 0 14px">NA SUA CONTA GRÁTIS</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${item(
            'Nota de cada praia, agora',
            'De 0 a 10, com o tamanho da onda, o período, o vento e a maré.',
          )}${item(
            'Previsão de 3 dias, hora a hora',
            'Arraste pela curva do dia e veja como o mar muda a cada hora.',
          )}${item(
            'Os picos de cada praia',
            'Qual pico funciona com o swell do dia e o caminho até lá pelo Google Maps ou Waze.',
          )}${item(
            'Diário de sessões',
            'Anote onde e como foi cada queda.',
          )}
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 0"><tr><td style="background:${accent};border-radius:12px">
            <a href="${APP_URL}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">Ver o mar agora</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:16px 0 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${card};border:1px solid ${line};border-radius:16px">
            <tr><td style="padding:20px 24px">
              <div style="font-size:15px;font-weight:700;color:${text};margin:0 0 6px">Dica: deixe o app na tela de início</div>
              <div style="font-size:14px;line-height:1.6;color:${muted}">
                No iPhone, abra no Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".<br>
                No Android, abra no Chrome, toque nos três pontinhos e depois em "Instalar app".
              </div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 0 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${line};border-radius:16px">
            <tr><td style="padding:20px 24px">
              <div style="font-size:15px;font-weight:700;color:${text};margin:0 0 6px">Quer mais?</div>
              <div style="font-size:14px;line-height:1.6;color:${muted};margin:0 0 10px">
                O Premium tem previsão de 14 dias, alerta quando o mar fica bom, chat com o Surf AI e comparação entre praias. Dá pra testar ${TRIAL_DAYS} dias grátis, sem cartão. Depois, ${formatBRL(PRICE_MONTHLY)} por mês ou ${formatBRL(PRICE_ANNUAL_PER_MONTH)} por mês no plano anual.
              </div>
              <a href="${APP_URL}/premium" style="font-size:14px;font-weight:700;color:${accent};text-decoration:none">Testar ${TRIAL_DAYS} dias grátis</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 4px 8px;font-size:13px;line-height:1.6;color:${muted}">
          Qualquer dúvida, é só responder este e-mail.<br>
          Surf AI Floripa · Florianópolis, SC · <a href="${APP_URL}/privacy" style="color:${muted}">Privacidade</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

async function sendWelcomeEmail(name: string, email: string) {
  const firstName = name?.trim().split(' ')[0] || 'surfista'
  const html = buildWelcomeHtml(escapeHtml(firstName))

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_KEY}`,
    },
    body: JSON.stringify({
      from: 'Surf AI Floripa <oi@alo.surfaifloripa.com.br>',
      reply_to: 'surfaifloripa@gmail.com',
      to: [email],
      subject: `Fala, ${firstName}! Bem-vindo ao Surf AI Floripa`,
      html,
    }),
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend error ${res.status}: ${err}`)
  }
}

const WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  // Valida assinatura do webhook Supabase para evitar spam/abuso.
  // Configurar SUPABASE_WEBHOOK_SECRET no Vercel e no painel Supabase → Webhooks.
  if (!WEBHOOK_SECRET || req.headers.get('Authorization') !== `Bearer ${WEBHOOK_SECRET}`) {
    console.error('[email-welcome] Assinatura de webhook inválida ou secret não configurado')
    return new Response('Unauthorized', { status: 401 })
  }

  if (!RESEND_KEY) {
    return new Response('RESEND_API_KEY não configurada', { status: 500 })
  }

  let body: { record?: { email?: string; raw_user_meta_data?: { full_name?: string } } }
  try {
    body = await req.json()
  } catch {
    return new Response('Body inválido', { status: 400 })
  }

  const email = body.record?.email
  const name = body.record?.raw_user_meta_data?.full_name ?? ''

  if (!email) return new Response('Email ausente', { status: 400 })

  try {
    await sendWelcomeEmail(name, email)
    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[email-welcome] erro:', err)
    return new Response(JSON.stringify({ sent: false, error: 'Erro interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
