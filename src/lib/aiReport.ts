import { BeachCondition } from './surfData'
import { supabase } from './supabase'

const CACHE_KEY = 'ai_report_cache'
const CACHE_DURATION = 30 * 60 * 1000

interface CachedReport {
  report: string
  fetchedAt: number
}

// A chave inclui o userId — sem isso, se a pessoa A sair sem passar pelo signOut()
// que limpa o cache (ex: fecha a aba) e a pessoa B entrar no mesmo aparelho dentro
// da janela de 30min, B via o relatório que era de A.
function cacheKey(userId: string): string {
  return `${CACHE_KEY}_${userId}`
}

function getCached(userId: string): CachedReport | null {
  try {
    const key = cacheKey(userId)
    for (const storage of [localStorage, sessionStorage]) {
      const raw = storage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as CachedReport
      if (Date.now() - parsed.fetchedAt > CACHE_DURATION) {
        storage.removeItem(key)
        continue
      }
      return parsed
    }
    return null
  } catch {
    return null
  }
}

function setCached(userId: string, report: string) {
  const payload = JSON.stringify({ report, fetchedAt: Date.now() })
  try { localStorage.setItem(cacheKey(userId), payload) } catch {
    try { sessionStorage.setItem(cacheKey(userId), payload) } catch { /* quota exceeded */ }
  }
}

export async function fetchAIReport(
  spots: BeachCondition[],
  topSpot: BeachCondition,
  userLevel?: string,
  userId?: string
): Promise<string | null> {
  if (!userId) return null
  const cached = getCached(userId)
  if (cached) return cached.report

  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return null

    const res = await fetch('/api/ai-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ spots, topSpot, userLevel }),
    })

    if (res.status === 403) {
      // Usuário free — não tenta retry, apenas retorna null silenciosamente
      return null
    }

    if (res.status === 401) {
      // Token expirado — tenta refresh antes de desistir
      const { data: refreshed } = await supabase.auth.refreshSession()
      const newToken = refreshed.session?.access_token
      if (!newToken) return null

      const retryRes = await fetch('/api/ai-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${newToken}`,
        },
        body: JSON.stringify({ spots, topSpot, userLevel }),
      })
      // Se ainda for 403 após refresh, o usuário não tem premium
      if (!retryRes.ok) return null
      const retryData = await retryRes.json()
      if (retryData.report) { setCached(userId, retryData.report); return retryData.report }
      return null
    }

    if (!res.ok) return null
    const data = await res.json()
    if (data.report) {
      setCached(userId, data.report)
      return data.report
    }
    return null
  } catch {
    return null
  }
}

// Limpa qualquer cache de relatório guardado (de qualquer usuário) — chamado no
// signOut() do AuthContext, prefixo em vez de chave exata porque a chave agora
// inclui o userId.
export function clearAIReportCache() {
  try {
    for (const storage of [localStorage, sessionStorage]) {
      for (const key of Object.keys(storage)) {
        if (key.startsWith(CACHE_KEY)) storage.removeItem(key)
      }
    }
  } catch { /* ignore */ }
}

/** Separa a primeira frase do resto, para destacá-la visualmente no card do relatório.
 *  Se o texto não tiver mais de uma frase, `rest` fica vazio e `first` é o texto todo —
 *  quem renderiza deve decidir se ainda faz sentido destacar nesse caso. */
export function splitFirstSentence(report: string): { first: string; rest: string } {
  const sentences = report.split(/(?<=[.!?])\s+/)
  const [first, ...rest] = sentences
  return { first, rest: rest.join(' ') }
}
