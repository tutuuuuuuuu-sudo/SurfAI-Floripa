// Provedores de IA de fallback pro chat (api/surf-chat.ts) — usados só quando o Gemini
// (api/_gemini.ts, fonte principal) falha ou esgota a cota. Groq e OpenRouter falam o
// mesmo formato "OpenAI-compatible" (chat/completions), diferente do Gemini — por isso
// os dois reaproveitam o mesmo helper interno, só trocando base URL/chave/modelo.

import type { ChatTurn, GeminiResult } from './_gemini.js'

async function callOpenAICompatibleChat(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemContext: string,
  history: ChatTurn[],
  maxOutputTokens: number,
  timeoutMs: number
): Promise<GeminiResult> {
  try {
    const messages = [
      { role: 'system', content: systemContext },
      ...history.map(turn => ({ role: turn.role === 'model' ? 'assistant' : 'user', content: turn.text })),
    ]

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: maxOutputTokens, temperature: 0.9 }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!res.ok) {
      const error = await res.text()
      return { ok: false, status: res.status, error }
    }

    const data = await res.json() as { choices?: { message?: { content?: string } }[] }
    const text = data.choices?.[0]?.message?.content ?? ''
    return { ok: true, text }
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : 'Erro desconhecido' }
  }
}

// Free tier: 14.400 requisições/dia, 30/min, 6.000 tokens/min — sem cartão de crédito
// (console.groq.com). Sozinho já cobre com folga qualquer volume realista do chat.
export function callGroqChat(
  apiKey: string,
  systemContext: string,
  history: ChatTurn[],
  maxOutputTokens: number,
  timeoutMs: number
): Promise<GeminiResult> {
  return callOpenAICompatibleChat(
    'https://api.groq.com/openai/v1', apiKey, 'llama-3.3-70b-versatile',
    systemContext, history, maxOutputTokens, timeoutMs
  )
}

// Free tier: 50 requisições/dia por padrão, ou 1.000/dia permanentemente após uma compra
// única (não recorrente) de US$10 em créditos na conta (openrouter.ai). Modelo `:free`
// específico pode mudar com o tempo — conferir a lista atual em openrouter.ai/models se
// esse parar de funcionar (retirado da lista gratuita).
export function callOpenRouterChat(
  apiKey: string,
  systemContext: string,
  history: ChatTurn[],
  maxOutputTokens: number,
  timeoutMs: number
): Promise<GeminiResult> {
  return callOpenAICompatibleChat(
    'https://openrouter.ai/api/v1', apiKey, 'meta-llama/llama-3.3-70b-instruct:free',
    systemContext, history, maxOutputTokens, timeoutMs
  )
}
