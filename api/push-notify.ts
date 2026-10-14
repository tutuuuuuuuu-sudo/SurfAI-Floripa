export const config = { runtime: 'edge' }

// Cron: roda a cada hora junto com o snapshot
// Busca subscriptions ativas, verifica condições e envia push para quem tiver praia boa

import { calculateSurfScore } from './_scoreEngine.js'
import { BEACH_REGISTRY } from './_beachRegistry.js'
import { isSchedulerCall } from './_auth.js'
import { sendPush, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } from './_webPush.js'
import { beachMatches, premiumOrAdminIds, favoritesByUser, isAlertHour, nextAlertBeach, markAlerted, type PushCriteria } from './_pushMatch.js'
import { todaySP, nowHourSP } from '../src/lib/timeSP.js'
// A criptografia mudou pra _webPush.ts (30/set/2026); reexportada aqui pro push-notify.test.ts
export { base64urlDecode, base64urlEncode, makeVapidJwt, encryptWebPush } from './_webPush.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? ''
const APP_URL = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'

const CORS = { 'Content-Type': 'application/json' }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS })
}

// ── Handler principal ────────────────────────────────────────────────────────

const BEACHES = BEACH_REGISTRY

const WIND_DIR_MAP: Record<string, number> = {
  N:0,NNE:22.5,NE:45,ENE:67.5,E:90,ESE:112.5,SE:135,SSE:157.5,
  S:180,SSW:202.5,SW:225,WSW:247.5,W:270,WNW:292.5,NW:315,NNW:337.5
}

export default async function handler(req: Request) {
  // Agendador do Supabase (isSchedulerCall) ou execução manual pelo GitHub (secret em query param)
  const secret = process.env.PUSH_NOTIFY_SECRET
  const provided = new URL(req.url).searchParams.get('secret')
  if (!(secret && provided === secret) && !(await isSchedulerCall(req))) return json({ error: 'Unauthorized' }, 401)

  if (!SUPABASE_URL || !SUPABASE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: 'Configuração incompleta' }, 500)
  }

  // Só de dia (ver isAlertHour); fora do horário nem consulta as praias
  if (!isAlertHour(nowHourSP())) return json({ ok: true, sent: 0, skipped: 'fora do horário' })
  const today = todaySP()

  // 1. Busca todas as subscriptions ativas
  const subRes = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?select=*`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!subRes.ok) return json({ error: 'Erro ao buscar subscriptions' }, 500)

  interface PushSub extends PushCriteria {
    id: string; user_id: string; endpoint: string
    p256dh: string; auth: string
    alerted_on: string | null; alerted_beaches: string[] | null
  }
  const allSubs = await subRes.json() as PushSub[]
  if (allSubs.length === 0) return json({ ok: true, sent: 0 })

  // 1b. "Alertas de swell (push)" é benefício Premium (ver tabela de planos no CLAUDE.md) —
  // antes disso, qualquer usuário logado que ativasse push recebia alerta de graça,
  // porque nem o cadastro (NotificationPanel.tsx) nem o envio checavam assinatura.
  const eligibleUserIds = await premiumOrAdminIds(SUPABASE_URL, SUPABASE_KEY, [...new Set(allSubs.map(s => s.user_id))])
  const subs = allSubs.filter(s => eligibleUserIds.has(s.user_id))
  if (subs.length === 0) return json({ ok: true, sent: 0, skippedNonPremium: allSubs.length })

  // 2. Busca favoritos de cada usuário (batch)
  const favsByUser = await favoritesByUser(SUPABASE_URL, SUPABASE_KEY, [...new Set(subs.map(s => s.user_id))])

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
      const rawDir = (data.windDirection ?? 'N').toUpperCase()
      const wD = WIND_DIR_MAP[rawDir] !== undefined ? rawDir : 'N'
      scores[beach.id] = calculateSurfScore(wH, wS, sP, wD, beach.orientation, beach.southExposure ?? 1)
    }))
  }

  // 4. Para cada subscription, verifica se tem praia boa (que ainda não foi avisada hoje) e envia push
  let sent = 0
  let alreadyAlerted = 0
  const toRemove: string[] = []

  await Promise.allSettled(subs.map(async sub => {
    const userFavs = favsByUser[sub.user_id] ?? []
    const goodBeaches = BEACHES
      .filter(b => beachMatches(sub, b.id, scores[b.id] ?? 0, userFavs))
      .sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0))

    if (goodBeaches.length === 0) return
    const bestId = nextAlertBeach(goodBeaches.map(b => b.id), sub, today)
    if (!bestId) { alreadyAlerted++; return }

    const best = goodBeaches.find(b => b.id === bestId)!
    const score = scores[best.id] ?? 0
    const payload = JSON.stringify({
      title: `${best.name} está boa agora`,
      body: `Nota ${score.toFixed(1)}/10 · Toca pra ver as condições`,
      url: `/spot/${best.id}`, // relativo: abre no endereço do app instalado (ver _sessionReminder.ts)
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    })

    const r = await sendPush(sub.endpoint, sub.p256dh, sub.auth, payload)
    if (r.gone) toRemove.push(sub.id) // só aparelho que não existe mais; recusa comum não apaga
    else if (r.ok) {
      sent++
      await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(markAlerted(sub, best.id, today)),
      })
    }
  }))

  // 5. Remove subscriptions expiradas (410)
  if (toRemove.length > 0) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?id=in.(${toRemove.join(',')})`,
      { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    )
  }

  return json({ ok: true, sent, alreadyAlerted, removed: toRemove.length })
}
