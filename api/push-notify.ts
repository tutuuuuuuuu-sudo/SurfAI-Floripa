export const config = { runtime: 'edge' }

// Cron: roda a cada hora junto com o snapshot
// Busca subscriptions ativas, verifica condições e envia push para quem tiver praia boa

import { calculateSurfScore } from './_scoreEngine.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const APP_URL = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? ''

const CORS = { 'Content-Type': 'application/json' }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS })
}

// ── VAPID JWT (assina o Authorization para o push service) ────────────────────

function base64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad), c => c.charCodeAt(0))
}

function base64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// Importa a chave VAPID privada (base64url raw 32 bytes) via JWK — sem montar DER manualmente.
// VAPID_PUBLIC_KEY é a chave pública em base64url (65 bytes uncompressed: 0x04 + x + y).
async function importVapidKey(): Promise<CryptoKey> {
  const privBytes = base64urlDecode(VAPID_PRIVATE_KEY)
  const pubBytes = base64urlDecode(VAPID_PUBLIC_KEY)
  // pubBytes = 0x04 || x (32) || y (32)
  const x = base64urlEncode(pubBytes.slice(1, 33))
  const y = base64urlEncode(pubBytes.slice(33, 65))
  const d = base64urlEncode(privBytes)
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x, y, d, key_ops: ['sign'] },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
}

async function makeVapidJwt(audience: string): Promise<string> {
  const header = base64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = base64urlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: 'mailto:surfaifloripa@gmail.com',
  })))
  const sigInput = new TextEncoder().encode(`${header}.${payload}`)
  const cryptoKey = await importVapidKey().catch(() => null)
  if (!cryptoKey) throw new Error('VAPID key import failed')
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, sigInput)
  return `${header}.${payload}.${base64urlEncode(sig)}`
}

// ── Envia um push para um endpoint ───────────────────────────────────────────

async function sendPush(endpoint: string, p256dh: string, auth: string, payload: string): Promise<boolean> {
  try {
    const origin = new URL(endpoint).origin
    const jwt = await makeVapidJwt(origin)
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        Authorization: `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
        TTL: '86400',
      },
      body: payload,
    })
    // 201, 200 = entregue; 410 = subscription expirou
    if (res.status === 410) return false // sinaliza para remover
    return res.ok || res.status === 201
  } catch {
    return true // erro de rede — não remove a subscription
  }
}

// ── Handler principal ────────────────────────────────────────────────────────

const BEACHES = [
  { id: 'campeche',       lat: -27.6977, lng: -48.4899, orientation: 90  },
  { id: 'novo-campeche',  lat: -27.6661, lng: -48.4755, orientation: 90  },
  { id: 'morro-pedras',   lat: -27.7171, lng: -48.5034, orientation: 100 },
  { id: 'matadeiro',      lat: -27.7548, lng: -48.4986, orientation: 110 },
  { id: 'lagoinha-leste', lat: -27.7732, lng: -48.4864, orientation: 180 },
  { id: 'acores',         lat: -27.7837, lng: -48.5237, orientation: 120 },
  { id: 'solidao',        lat: -27.7941, lng: -48.5335, orientation: 130 },
  { id: 'armacao',        lat: -27.7504, lng: -48.5018, orientation: 115 },
  { id: 'naufragados',    lat: -27.8336, lng: -48.5642, orientation: 180 },
  { id: 'joaquina',       lat: -27.6294, lng: -48.4490, orientation: 90  },
  { id: 'mole',           lat: -27.6022, lng: -48.4327, orientation: 85  },
  { id: 'mocambique',     lat: -27.4938, lng: -48.3955, orientation: 80  },
  { id: 'barra-lagoa',    lat: -27.5735, lng: -48.4249, orientation: 75  },
  { id: 'santinho',       lat: -27.4619, lng: -48.3762, orientation: 70  },
  { id: 'ponta-aranhas',  lat: -27.4802, lng: -48.3770, orientation: 65  },
]

const WIND_DIR_MAP: Record<string, number> = {
  N:0,NNE:22.5,NE:45,ENE:67.5,E:90,ESE:112.5,SE:135,SSE:157.5,
  S:180,SSW:202.5,SW:225,WSW:247.5,W:270,WNW:292.5,NW:315,NNW:337.5
}

export default async function handler(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('Authorization')
  // Vercel injeta Authorization: Bearer <CRON_SECRET> automaticamente quando CRON_SECRET está configurado
  const isVercelCron = req.method === 'GET' && cronSecret && authHeader === `Bearer ${cronSecret}`
  if (!isVercelCron) {
    const secret = process.env.PUSH_NOTIFY_SECRET
    const provided = new URL(req.url).searchParams.get('secret')
    if (secret && provided !== secret) return json({ error: 'Unauthorized' }, 401)
  }

  if (!SUPABASE_URL || !SUPABASE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: 'Configuração incompleta' }, 500)
  }

  // 1. Busca todas as subscriptions ativas
  const subRes = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?select=*`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!subRes.ok) return json({ error: 'Erro ao buscar subscriptions' }, 500)

  interface PushSub {
    id: string; user_id: string; endpoint: string
    p256dh: string; auth: string
    min_score: number; favorite_only: boolean
  }
  const subs = await subRes.json() as PushSub[]
  if (subs.length === 0) return json({ ok: true, sent: 0 })

  // 2. Busca favoritos de cada usuário (batch)
  const userIds = [...new Set(subs.map(s => s.user_id))]
  const favsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/favorites?user_id=in.(${userIds.join(',')})&select=user_id,spot_id`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  )
  const favsRows = favsRes.ok ? await favsRes.json() as { user_id: string; spot_id: string }[] : []
  const favsByUser: Record<string, string[]> = {}
  for (const r of favsRows) {
    if (!favsByUser[r.user_id]) favsByUser[r.user_id] = []
    favsByUser[r.user_id].push(r.spot_id)
  }

  // 3. Busca condições atuais (reutiliza /api/surf em lotes)
  const scores: Record<string, number> = {}
  const BATCH = 5
  for (let i = 0; i < BEACHES.length; i += BATCH) {
    const batch = BEACHES.slice(i, i + BATCH)
    await Promise.allSettled(batch.map(async beach => {
      const res = await fetch(
        `${APP_URL}/api/surf?lat=${beach.lat}&lng=${beach.lng}&orientation=${beach.orientation}`,
        { signal: AbortSignal.timeout(10000) }
      )
      if (!res.ok) return
      const data = await res.json() as { waveHeight?: number; windSpeed?: number; windDirection?: string; swellPeriod?: number }
      const wH = data.waveHeight ?? 1
      const wS = data.windSpeed ?? 12
      const sP = data.swellPeriod ?? 10
      const rawDir = (data.windDirection ?? 'N').split('(')[0].trim().toUpperCase()
      const wD = WIND_DIR_MAP[rawDir] !== undefined ? rawDir : 'N'
      scores[beach.id] = calculateSurfScore(wH, wS, sP, wD, beach.orientation)
    }))
  }

  // 4. Para cada subscription, verifica se tem praia boa e envia push
  let sent = 0
  const toRemove: string[] = []

  await Promise.allSettled(subs.map(async sub => {
    const userFavs = favsByUser[sub.user_id] ?? []
    const goodBeaches = BEACHES.filter(b => {
      const score = scores[b.id] ?? 0
      if (score < sub.min_score) return false
      if (sub.favorite_only && !userFavs.includes(b.id)) return false
      return true
    }).sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0))

    if (goodBeaches.length === 0) return

    const best = goodBeaches[0]
    const score = scores[best.id] ?? 0
    const payload = JSON.stringify({
      title: `${best.id.replace(/-/g, ' ')} está ótima agora! 🏄`,
      body: `Score ${score.toFixed(1)}/10 · Toca ver as condições`,
      url: `${APP_URL}/spot/${best.id}`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    })

    const ok = await sendPush(sub.endpoint, sub.p256dh, sub.auth, payload)
    if (!ok) toRemove.push(sub.id)
    else sent++
  }))

  // 5. Remove subscriptions expiradas (410)
  if (toRemove.length > 0) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?id=in.(${toRemove.join(',')})`,
      { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    )
  }

  return json({ ok: true, sent, removed: toRemove.length })
}
