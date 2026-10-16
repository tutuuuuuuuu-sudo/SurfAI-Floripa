export const config = { runtime: 'edge' }

// Endpoint mínimo pra frontend ler quanto da cota diária do chat (api/surf-chat.ts) o
// usuário já consumiu, SEM gastar uma mensagem — usado só pra mostrar a barra de uso ao
// abrir o SurfChatPanel, antes de qualquer envio. Depois do primeiro envio da sessão, o
// próprio api/surf-chat.ts já devolve `used`/`max`/`remaining` atualizados na resposta, esse
// endpoint só cobre o estado inicial.

const ALLOWED_ORIGIN = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

import { verifyToken, isPremiumUser } from './_auth.js'
import { createPersistentRateLimitPeeker } from './_httpUtils.js'
import { CHAT_RATE_LIMIT_PREFIX, CHAT_DAILY_MAX, CHAT_WINDOW_MS } from './surf-chat.js'

const peekChatUsage = createPersistentRateLimitPeeker(CHAT_RATE_LIMIT_PREFIX, CHAT_DAILY_MAX, CHAT_WINDOW_MS)

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '').trim()
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const { valid, userId } = await verifyToken(token)
  if (!valid || !userId) return json({ error: 'Unauthorized' }, 401)

  const premium = await isPremiumUser(userId)
  if (!premium) return json({ error: 'Premium required', code: 'NOT_PREMIUM' }, 403)

  const usage = await peekChatUsage(userId)
  return json(usage)
}
