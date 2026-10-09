// Cache de resultados prontos na tabela live_conditions_cache do Supabase (mesmo padrão de
// _liveConditions.ts): uma linha por chave, com o momento em que foi gravada. Usado pelo resumo
// de 14 dias das praias (api/_beachDays.ts), que o chat e a aba Previsão dividem.
// Prefixo _ = não exposto como endpoint HTTP pelo Vercel.

function credentials() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  return url && key ? { url, key } : null
}

export async function getCachedJson<T>(cacheKey: string, ttlMs: number): Promise<T | null> {
  const c = credentials()
  if (!c) return null
  try {
    const res = await fetch(
      `${c.url}/rest/v1/live_conditions_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&select=payload,fetched_at`,
      { headers: { apikey: c.key, Authorization: `Bearer ${c.key}` } }
    )
    if (!res.ok) return null
    const rows = await res.json() as { payload: T; fetched_at: string }[]
    const row = rows[0]
    if (!row || Date.now() - new Date(row.fetched_at).getTime() > ttlMs) return null
    return row.payload
  } catch (err) {
    console.error('[cache] GET lançou exceção:', cacheKey, err)
    return null
  }
}

export async function setCachedJson(cacheKey: string, payload: unknown): Promise<void> {
  const c = credentials()
  if (!c) return
  try {
    await fetch(`${c.url}/rest/v1/live_conditions_cache`, {
      method: 'POST',
      headers: {
        apikey: c.key, Authorization: `Bearer ${c.key}`,
        'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ cache_key: cacheKey, payload, fetched_at: new Date().toISOString() }),
    })
  } catch (err) {
    console.error('[cache] SET lançou exceção:', cacheKey, err)
  }
}
