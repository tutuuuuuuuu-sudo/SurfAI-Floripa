import { BeachCondition } from './surfData'
import { supabase } from './supabase'

const CACHE_KEY = 'ai_report_cache'
const CACHE_DURATION = 30 * 60 * 1000

interface CachedReport {
  report: string
  fetchedAt: number
}

function getCached(): CachedReport | null {
  try {
    // Tenta localStorage primeiro (persiste entre sessões dentro do mesmo dia)
    for (const storage of [localStorage, sessionStorage]) {
      const raw = storage.getItem(CACHE_KEY)
      if (!raw) continue
      const parsed = JSON.parse(raw) as CachedReport
      if (Date.now() - parsed.fetchedAt > CACHE_DURATION) {
        storage.removeItem(CACHE_KEY)
        continue
      }
      return parsed
    }
    return null
  } catch {
    return null
  }
}

function setCached(report: string) {
  const payload = JSON.stringify({ report, fetchedAt: Date.now() })
  try { localStorage.setItem(CACHE_KEY, payload) } catch {
    try { sessionStorage.setItem(CACHE_KEY, payload) } catch { /* quota exceeded */ }
  }
}

export async function fetchAIReport(
  spots: BeachCondition[],
  topSpot: BeachCondition,
  userLevel?: string
): Promise<string | null> {
  const cached = getCached()
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
    if (!res.ok) return null
    const data = await res.json()
    if (data.report) {
      setCached(data.report)
      return data.report
    }
    return null
  } catch {
    return null
  }
}

export function clearAIReportCache() {
  try { localStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
  try { sessionStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
}
