export function isValidCoord(lat: string | null, lng: string | null): boolean {
  if (!lat || !lng) return false
  const latN = parseFloat(lat), lngN = parseFloat(lng)
  return !isNaN(latN) && !isNaN(lngN) && latN >= -90 && latN <= 90 && lngN >= -180 && lngN <= 180
}

// Rate limit simples por IP, em memória (por instância — cada instância serverless tem seu
// próprio contador, então sob tráfego alto com várias instâncias em paralelo o limite real
// não é 100% respeitado). Usar só em endpoints públicos de dados (surf/maré/previsão) onde
// o pior caso de burlar o limite é mais carga numa API externa gratuita, não risco de
// segurança/dinheiro — para esses casos ver `createPersistentRateLimiter` abaixo.
export function createRateLimiter(maxPerWindow: number, windowMs = 60_000) {
  const hits = new Map<string, { count: number; reset: number }>()
  return function checkRateLimit(ip: string): boolean {
    const now = Date.now()
    const entry = hits.get(ip)
    if (!entry || now > entry.reset) {
      hits.set(ip, { count: 1, reset: now + windowMs })
      return true
    }
    if (entry.count >= maxPerWindow) return false
    entry.count++
    return true
  }
}

// Rate limit persistido no Postgres (função `check_rate_limit`, migração
// `create_persistent_rate_limit_function`) — um único contador atômico compartilhado por
// todas as instâncias serverless, ao contrário do `createRateLimiter` acima. Usar nos
// endpoints onde um limite furado tem custo real: dinheiro (pagamento), exclusão de conta,
// webhook externo, ou custo de API de IA.
// Falha aberta: se a checagem em si falhar (env var ausente, erro de rede/HTTP), deixa a
// requisição passar em vez de derrubar o endpoint por causa do rate limiter — o log de erro
// fica registrado pra investigar depois.
export function createPersistentRateLimiter(prefix: string, maxPerWindow: number, windowMs = 60_000) {
  const windowSeconds = Math.max(1, Math.round(windowMs / 1000))
  return async function checkRateLimit(key: string): Promise<boolean> {
    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
    if (!supabaseUrl || !serviceKey) {
      console.error(`[rateLimit:${prefix}] SUPABASE_URL/SERVICE_ROLE_KEY ausente — limite não aplicado`)
      return true
    }
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/check_rate_limit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ p_key: `${prefix}:${key}`, p_max: maxPerWindow, p_window_seconds: windowSeconds }),
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) {
        console.error(`[rateLimit:${prefix}] HTTP ${res.status} ao checar limite — deixando passar`)
        return true
      }
      return (await res.json()) as boolean
    } catch (err) {
      console.error(`[rateLimit:${prefix}] Erro de rede ao checar limite — deixando passar:`, err)
      return true
    }
  }
}
