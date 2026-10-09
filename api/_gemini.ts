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
  // edge da Vercel (~25s).
  timeoutMs = 20000
): Promise<GeminiResult> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // thinkingConfig.thinkingBudget foi tentado aqui pra pular o raciocínio interno
          // do gemini-3.6-flash, mas a API rejeita com 400 "invalid argument" nessa versão
          // do schema — removido. O parsing abaixo já resolve o problema original (pular
          // partes de raciocínio) sem precisar desse campo.
          generationConfig: { maxOutputTokens, temperature: 0.9 },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      }
    )

    if (!res.ok) {
      const error = await res.text()
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
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemContext }] },
          contents: history.map(turn => ({ role: turn.role, parts: [{ text: turn.text }] })),
          generationConfig: { maxOutputTokens, temperature: 0.9 },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      }
    )

    if (!res.ok) {
      const error = await res.text()
      return { ok: false, status: res.status, error }
    }

    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] }
    const parts = data.candidates?.[0]?.content?.parts ?? []
    const text = parts.find(p => !p.thought && p.text)?.text ?? parts[0]?.text ?? ''
    return { ok: true, text }
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : 'Erro desconhecido' }
  }
}
