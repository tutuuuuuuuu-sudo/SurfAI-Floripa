// Envio pelo Telegram (bot próprio, API oficial e grátis) — relatório diário do founder desde
// 16/out/2026. Troca o CallMeBot (_callmebot.ts), que em ~13/out passou a colar "I need your
// support" em toda mensagem grátis. Prefixo _ = não exposto como endpoint HTTP pelo Vercel.

import { splitForWhatsApp } from './_callmebot.js'

// Limite do Telegram é 4096 caracteres por mensagem; o relatório tem uns 450
const TELEGRAM_MAX_CHARS = 4000

// O texto do relatório marca negrito com *asterisco* (jeito do WhatsApp). O Telegram lê HTML:
// escapa &, < e > e troca *assim* por <b>assim</b>.
export function toTelegramHtml(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return escaped.replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
}

// true só se todos os pedaços saíram. Bot que a pessoa nunca abriu (sem "Iniciar") não consegue
// mandar mensagem: o Telegram responde 403 e o motivo fica no log.
export async function sendTelegram(token: string, chatId: string, text: string): Promise<boolean> {
  for (const chunk of splitForWhatsApp(text, TELEGRAM_MAX_CHARS)) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: toTelegramHtml(chunk), parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) {
        console.error('[telegram] envio voltou', res.status, (await res.text()).slice(0, 200))
        return false
      }
    } catch (err) {
      console.error('[telegram] envio falhou:', err instanceof Error ? err.message : err)
      return false
    }
  }
  return true
}
