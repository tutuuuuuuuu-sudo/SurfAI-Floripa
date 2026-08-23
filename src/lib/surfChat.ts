import { BeachCondition } from './surfData'
import { supabase } from './supabase'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export type SendChatResult =
  | { ok: true; reply: string }
  | { ok: false; error: string; rateLimited?: boolean }

async function postChatMessage(token: string, message: string, spots: BeachCondition[], userLevel?: string) {
  return fetch('/api/surf-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      message,
      userLevel,
      spots: spots.slice(0, 6).map(s => ({
        name: s.name, score: s.score, waveHeight: s.waveHeight,
        windSpeed: s.windSpeed, windDirection: s.windDirection, swellPeriod: s.swellPeriod,
      })),
    }),
  })
}

// Mesmo padrão de retry em 401 já usado em fetchAIReport (src/lib/aiReport.ts).
export async function sendChatMessage(message: string, spots: BeachCondition[], userLevel?: string): Promise<SendChatResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return { ok: false, error: 'Você precisa estar logado.' }

    let res = await postChatMessage(token, message, spots, userLevel)

    if (res.status === 401) {
      const { data: refreshed } = await supabase.auth.refreshSession()
      const newToken = refreshed.session?.access_token
      if (!newToken) return { ok: false, error: 'Sessão expirada. Entre novamente.' }
      res = await postChatMessage(newToken, message, spots, userLevel)
    }

    if (res.status === 429) return { ok: false, error: 'Limite diário de mensagens atingido. Volta amanhã!', rateLimited: true }
    if (res.status === 403) return { ok: false, error: 'Esse recurso é exclusivo Premium.' }
    if (!res.ok) return { ok: false, error: 'Não consegui responder agora. Tenta de novo.' }

    const data = await res.json() as { reply?: string; error?: string }
    if (!data.reply) return { ok: false, error: data.error ?? 'Resposta vazia.' }
    return { ok: true, reply: data.reply }
  } catch {
    return { ok: false, error: 'Erro de conexão. Verifique sua internet e tente de novo.' }
  }
}

// Lê o histórico direto via supabase-js (RLS já restringe às próprias mensagens) — mesmo
// padrão de getFavorites em src/lib/favorites.ts, sem precisar de endpoint dedicado.
export async function loadChatHistory(): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .order('created_at', { ascending: true })
    .limit(200)

  if (error || !data) return []
  return data as ChatMessage[]
}

export async function clearChatHistory(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('user_id', user.id)

  return !error
}
