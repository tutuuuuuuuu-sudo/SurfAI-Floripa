export function isValidCoord(lat: string | null, lng: string | null): boolean {
  if (!lat || !lng) return false
  const latN = parseFloat(lat), lngN = parseFloat(lng)
  return !isNaN(latN) && !isNaN(lngN) && latN >= -90 && latN <= 90 && lngN >= -180 && lngN <= 180
}

// Rate limit simples por IP, em memória (por instância — ver observação em CLAUDE.md/auditoria).
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
