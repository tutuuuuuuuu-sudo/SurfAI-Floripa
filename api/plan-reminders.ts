export const config = { runtime: 'edge' }

// Robô diário (agendador do Supabase, robo-lembretes, 12h UTC = 9h em Brasília): avisa quem está
// com o Premium ou o teste grátis perto do fim, por e-mail e por notificação no celular (quando a
// pessoa ativou os alertas). Avisos e textos em _planReminders.ts; a tabela plan_reminders impede
// mandar o mesmo aviso duas vezes pro mesmo período.

import { isSchedulerCall } from './_auth.js'
import { sendPush } from './_webPush.js'
import { reminderKind, buildReminderMessage, buildReminderHtml, type ReminderKind } from './_planReminders.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY
const AGENT_SECRET = process.env.AGENT_SECRET
const APP_URL = process.env.APP_URL ?? 'https://www.surfaifloripa.com.br'

const DAY = 24 * 60 * 60 * 1000

const escapeHtml = (t: string) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

interface SubRow { user_id: string; plan: string; expires_at: string }
interface PushRow { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }

export default async function handler(req: Request) {
  const secret = req.headers.get('x-agent-secret')
  if (!(AGENT_SECRET && secret === AGENT_SECRET) && !(await isSchedulerCall(req))) {
    return json({ error: 'Unauthorized' }, 401)
  }
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'Configuração de servidor incompleta' }, 500)

  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }
  const now = Date.now()

  // Quem vence nos próximos 5 dias ou venceu nos últimos 2
  const from = new Date(now - 2 * DAY).toISOString()
  const to = new Date(now + 5 * DAY).toISOString()
  const subsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/subscriptions?status=eq.premium&expires_at=gte.${from}&expires_at=lte.${to}&select=user_id,plan,expires_at`,
    { headers },
  )
  if (!subsRes.ok) return json({ error: 'Erro ao buscar assinaturas' }, 500)
  const subs = (await subsRes.json() as SubRow[])
    .map(s => ({ ...s, kind: reminderKind(s.expires_at, now) }))
    .filter((s): s is SubRow & { kind: ReminderKind } => s.kind !== null)
  if (subs.length === 0) return json({ ok: true, checked: 0, sent: 0 })

  const userIds = subs.map(s => s.user_id)
  const pushRes = await fetch(
    `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=in.(${userIds.join(',')})&select=id,user_id,endpoint,p256dh,auth`,
    { headers },
  )
  const pushRows = pushRes.ok ? await pushRes.json() as PushRow[] : []

  const results: { kind: ReminderKind; plan: string; email: boolean; push: number; skipped?: string }[] = []
  const gonePush: string[] = []

  for (const sub of subs) {
    // Reserva o aviso antes de mandar: se já existe linha (user, aviso, período), outro disparo já cuidou
    const claimRes = await fetch(`${SUPABASE_URL}/rest/v1/plan_reminders`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({ user_id: sub.user_id, kind: sub.kind, period_end: sub.expires_at, plan: sub.plan }),
    })
    const claimed = claimRes.ok ? await claimRes.json() as unknown[] : []
    if (claimed.length === 0) {
      results.push({ kind: sub.kind, plan: sub.plan, email: false, push: 0, skipped: claimRes.ok ? 'já avisado' : 'erro ao reservar' })
      continue
    }

    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${sub.user_id}`, { headers })
    const user = userRes.ok ? await userRes.json() as { email?: string; user_metadata?: { full_name?: string } } : null
    const firstName = escapeHtml(user?.user_metadata?.full_name?.trim().split(' ')[0] || 'surfista')
    const msg = buildReminderMessage({ kind: sub.kind, plan: sub.plan, expiresAt: sub.expires_at, firstName, now })

    let emailOk = false
    if (user?.email && RESEND_API_KEY) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Surf AI Floripa <oi@alo.surfaifloripa.com.br>',
            reply_to: 'surfaifloripa@gmail.com',
            to: [user.email],
            subject: msg.subject,
            html: buildReminderHtml(msg, APP_URL),
          }),
          signal: AbortSignal.timeout(10000),
        })
        emailOk = res.ok
        if (!res.ok) console.error('[plan-reminders] Resend recusou', res.status, (await res.text()).slice(0, 200))
      } catch (err) {
        console.error('[plan-reminders] erro no e-mail', err)
      }
    }

    let pushSent = 0
    const payload = JSON.stringify({
      title: msg.pushTitle,
      body: msg.pushBody,
      url: `${APP_URL}/premium`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    })
    for (const p of pushRows.filter(r => r.user_id === sub.user_id)) {
      const r = await sendPush(p.endpoint, p.p256dh, p.auth, payload)
      if (r.ok) pushSent++
      else if (r.gone) gonePush.push(p.id)
    }

    const key = `user_id=eq.${sub.user_id}&kind=eq.${sub.kind}&period_end=eq.${encodeURIComponent(sub.expires_at)}`
    if (!emailOk && pushSent === 0) {
      // Nada chegou: solta a reserva pro próximo disparo tentar de novo
      await fetch(`${SUPABASE_URL}/rest/v1/plan_reminders?${key}`, { method: 'DELETE', headers })
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/plan_reminders?${key}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ email_ok: emailOk, push_sent: pushSent }),
      })
    }
    results.push({ kind: sub.kind, plan: sub.plan, email: emailOk, push: pushSent })
  }

  if (gonePush.length > 0) {
    await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=in.(${gonePush.join(',')})`, { method: 'DELETE', headers })
  }

  const sent = results.filter(r => r.email || r.push > 0).length
  return json({ ok: true, checked: subs.length, sent, results })
}
