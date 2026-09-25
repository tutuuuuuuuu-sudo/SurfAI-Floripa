import { rewrite } from '@vercel/functions'

export const config = { matcher: '/spot/:id*' }

// Bots de crawler/preview não executam JS — sem isso, todo link de /spot/:id
// compartilhado no WhatsApp/Instagram/Google mostraria o título genérico do app
// em vez do nome do pico e score real. Usuários reais (sem esses User-Agents)
// continuam recebendo a SPA normalmente.
const BOT_UA = /bot|facebookexternalhit|whatsapp|telegrambot|slackbot|twitterbot|linkedinbot|discordbot|googlebot|bingbot|pinterest|skypeuripreview/i

export default function middleware(req: Request) {
  const ua = req.headers.get('user-agent') ?? ''
  if (!BOT_UA.test(ua)) return

  const url = new URL(req.url)
  const id = url.pathname.split('/').filter(Boolean)[1] ?? ''
  const metaUrl = new URL('/api/spot-meta', url.origin)
  metaUrl.searchParams.set('id', id)
  return rewrite(metaUrl)
}
