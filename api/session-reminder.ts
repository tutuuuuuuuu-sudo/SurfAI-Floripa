export const config = { runtime: 'edge' }

// Robô diário (agendador do Supabase, robo-caiu-hoje, 22h UTC = 19h em Brasília): "Caiu hoje?"
// por notificação pra quem tem os alertas ligados, nos dias em que o mar bateu o alerta da pessoa
// e ela ainda não registrou sessão. Regras em _sessionReminder.ts.

import { isSchedulerCall } from './_auth.js'
import { sendPush } from './_webPush.js'
import { premiumOrAdminIds, favoritesByUser, type PushCriteria } from './_pushMatch.js'
import { peaksByBeach, pickReminder, buildReminderPush, skipReason, REMINDER_FROM_HOUR, REMINDER_TTL_SECONDS, type SnapshotRow } from './_sessionReminder.js'
import { todaySP } from '../src/lib/timeSP.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
const AGENT_SECRET = process.env.AGENT_SECRET

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

interface PushRow extends PushCriteria { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }
interface PrefRow { user_id: string; session_reminder_enabled: boolean | null; surfed_prompt_dismissed_on: string | null; session_reminder_sent_on: string | null }

export default async function handler(req: Request) {
  const secret = req.headers.get('x-agent-secret')
  if (!(AGENT_SECRET && secret === AGENT_SECRET) && !(await isSchedulerCall(req))) {
    return json({ error: 'Unauthorized' }, 401)
  }
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'Configuração de servidor incompleta' }, 500)
  // ?ensaio=1: calcula pra quem e o que mandaria, sem mandar nem marcar nada (pra conferir a regra
  // com os dados reais do dia)
  const dryRun = new URL(req.url).searchParams.get('ensaio') === '1'
  const wouldSend: { user: string; device: string; title: string; body: string; url: string }[] = []
  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }
  const rest = (path: string) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers })

  const pushRes = await rest('push_subscriptions?select=id,user_id,endpoint,p256dh,auth,min_score,favorite_only,beach_thresholds')
  if (!pushRes.ok) return json({ error: 'Erro ao buscar aparelhos' }, 500)
  const allDevices = await pushRes.json() as PushRow[]
  const eligible = await premiumOrAdminIds(SUPABASE_URL, SERVICE_KEY, [...new Set(allDevices.map(d => d.user_id))])
  const devices = allDevices.filter(d => eligible.has(d.user_id))
  const userIds = [...new Set(devices.map(d => d.user_id))]
  if (userIds.length === 0) return json({ ok: true, users: 0, sent: 0 })

  const today = todaySP()
  const from = new Date(`${today}T${String(REMINDER_FROM_HOUR).padStart(2, '0')}:00:00-03:00`).toISOString()
  const to = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const inUsers = `user_id=in.(${userIds.join(',')})`
  const [prefsRes, sessionsRes, snapsRes, favorites] = await Promise.all([
    rest(`user_preferences?${inUsers}&select=user_id,session_reminder_enabled,surfed_prompt_dismissed_on,session_reminder_sent_on`),
    rest(`surf_sessions?${inUsers}&date=eq.${today}&select=user_id`),
    rest(`score_snapshots?captured_at=gte.${from}&captured_at=lte.${to}&select=beach_id,beach_name,score,captured_at&limit=2000`),
    favoritesByUser(SUPABASE_URL, SERVICE_KEY, userIds),
  ])
  // Sem saber quem já registrou sessão, melhor não mandar nada do que perguntar pra quem já respondeu
  if (!prefsRes.ok || !sessionsRes.ok || !snapsRes.ok) {
    return json({ error: 'Erro ao buscar dados', prefs: prefsRes.status, sessions: sessionsRes.status, snapshots: snapsRes.status }, 500)
  }
  const prefs = new Map((await prefsRes.json() as PrefRow[]).map(p => [p.user_id, p]))
  const surfedToday = new Set((await sessionsRes.json() as { user_id: string }[]).map(s => s.user_id))
  const peaks = peaksByBeach(await snapsRes.json() as SnapshotRow[])

  const skipped: Record<string, number> = {}
  const gone: string[] = []
  let sent = 0
  for (const userId of userIds) {
    const pref = prefs.get(userId)
    const reason = skipReason({
      hasSessionToday: surfedToday.has(userId),
      enabled: pref?.session_reminder_enabled ?? true,
      dismissedOn: pref?.surfed_prompt_dismissed_on ?? null,
      sentOn: pref?.session_reminder_sent_on ?? null,
    }, today)
    if (reason) { skipped[reason] = (skipped[reason] ?? 0) + 1; continue }

    // Cada aparelho tem o próprio critério de alerta
    let matched = 0
    let delivered = 0
    for (const device of devices.filter(d => d.user_id === userId)) {
      const peak = pickReminder(peaks, device, favorites[userId] ?? [])
      if (!peak) continue
      matched++
      const push = buildReminderPush(peak, today)
      if (dryRun) {
        wouldSend.push({ user: userId.slice(0, 8), device: new URL(device.endpoint).host, title: push.title, body: push.body, url: push.url })
        delivered++
        continue
      }
      const r = await sendPush(device.endpoint, device.p256dh, device.auth, JSON.stringify(push), REMINDER_TTL_SECONDS)
      if (r.ok) delivered++
      else if (r.gone) gone.push(device.id)
    }
    if (delivered === 0) {
      const why = matched === 0 ? 'mar não bateu o alerta' : 'envio falhou'
      skipped[why] = (skipped[why] ?? 0) + 1
      continue
    }
    sent++
    if (dryRun) continue
    await fetch(`${SUPABASE_URL}/rest/v1/user_preferences?on_conflict=user_id`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: userId, session_reminder_sent_on: today }),
    })
  }

  if (gone.length > 0) {
    await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=in.(${gone.join(',')})`, { method: 'DELETE', headers })
  }
  return json({ ok: true, users: userIds.length, sent, skipped, removed: gone.length, ...(dryRun ? { dryRun, wouldSend } : {}) })
}
