// Chamada centralizada à API do Google Gemini — fonte única do modelo usado pelos
// endpoints que geram texto com IA (ai-report, content-agent, daily-report), pra não
// ter o mesmo fetch duplicado em três lugares. Free tier via chave do Google AI
// Studio (ai.google.dev), sem cartão de crédito — troca a Anthropic (paga, sem tier
// grátis contínuo) que ficava sem crédito e derrubava o relatório sem avisar ninguém.
// Prefixo _ indica que não é um handler HTTP — não será exposto como endpoint pelo Vercel.

// gemini-2.0-flash foi descontinuado pelo Google em ago/2026 (erro 404 dizia
// explicitamente pra trocar por este) — se voltar a dar 404 "no longer available",
// checar qual é o modelo atual recomendado na mensagem de erro antes de trocar de novo.
const GEMINI_MODEL = 'gemini-3.6-flash'

export type GeminiResult =
  | { ok: true; text: string }
  | { ok: false; status: number; error: string }

export async function callGemini(
  apiKey: string,
  prompt: string,
  maxOutputTokens: number,
  // Raciocínio interno do gemini-3.6-flash + maxOutputTokens maiores (ver ai-report.ts)
  // pode levar mais tempo — 20s dá folga sem estourar o limite de execução das funções
  // edge da Vercel (~25s). É o tempo total, já contando a nova tentativa (ver requestGemini).
  timeoutMs = 20000
): Promise<GeminiResult> {
  return requestGemini(apiKey, {
    contents: [{ parts: [{ text: prompt }] }],
    // thinkingConfig.thinkingBudget foi tentado aqui pra pular o raciocínio interno
    // do gemini-3.6-flash, mas a API rejeita com 400 "invalid argument" nessa versão
    // do schema — removido. O parsing abaixo já resolve o problema original (pular
    // partes de raciocínio) sem precisar desse campo.
    generationConfig: { maxOutputTokens, temperature: 0.9 },
  }, timeoutMs)
}

// Erros do lado do Google que passam sozinhos em segundos: 503 "This model is currently
// experiencing high demand" (relatório da noite de 13/out/2026 saiu sem a análise por isso) e
// 500. Antes desistia na primeira resposta; agora espera um pouco e tenta mais uma vez, desde
// que ainda sobre tempo. Cota estourada (429) não tenta de novo: não passa em segundos.
const RETRY_STATUS = new Set([500, 503])
export const GEMINI_RETRY_PAUSE_MS = 2000
// Tempo mínimo que precisa sobrar depois da pausa pra valer a pena tentar de novo
const MIN_RETRY_WINDOW_MS = 4000

async function requestGemini(apiKey: string, body: unknown, timeoutMs: number): Promise<GeminiResult> {
  const deadline = Date.now() + timeoutMs
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
        }
      )

      if (!res.ok) {
        const error = await res.text()
        const timeLeft = deadline - Date.now() - GEMINI_RETRY_PAUSE_MS
        if (attempt === 1 && RETRY_STATUS.has(res.status) && timeLeft >= MIN_RETRY_WINDOW_MS) {
          console.warn(`[gemini] ${res.status} na 1ª tentativa, tentando de novo em ${GEMINI_RETRY_PAUSE_MS / 1000} s`)
          await new Promise(resolve => setTimeout(resolve, GEMINI_RETRY_PAUSE_MS))
          continue
        }
        return { ok: false, status: res.status, error }
      }

      const data = await res.json() as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] }
      const parts = data.candidates?.[0]?.content?.parts ?? []
      // Pula qualquer parte marcada como "thought" (raciocínio interno) — só a resposta
      // final importa. Sem essa marcação (modelo sem thinking), cai na primeira parte normal.
      const text = parts.find(p => !p.thought && p.text)?.text ?? parts[0]?.text ?? ''
      return { ok: true, text }
    } catch (error) {
      return { ok: false, status: 0, error: error instanceof Error ? error.message : 'Erro desconhecido' }
    }
  }
}

export interface ChatTurn {
  role: 'user' | 'model'
  text: string
}

// Versão multi-turn de callGemini, usada pelo chat (api/surf-chat.ts) — os outros
// chamadores (ai-report, content-agent, daily-report) continuam usando callGemini acima,
// que é single-turn e não precisa de histórico de conversa.
export async function callGeminiChat(
  apiKey: string,
  systemContext: string,
  history: ChatTurn[],
  maxOutputTokens: number,
  timeoutMs = 20000
): Promise<GeminiResult> {
  return requestGemini(apiKey, {
    systemInstruction: { parts: [{ text: systemContext }] },
    contents: history.map(turn => ({ role: turn.role, parts: [{ text: turn.text }] })),
    generationConfig: { maxOutputTokens, temperature: 0.9 },
  }, timeoutMs)
}
