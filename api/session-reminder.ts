export const config = { runtime: 'edge' }

// "Caiu hoje?" por notificação, chamada manual (agendador do Supabase ou x-agent-secret). O envio
// de todo dia às 19h roda dentro do robô de alertas de hora em hora (push-notify.ts), sem job
// próprio no agendador. ?ensaio=1 calcula pra quem e o que mandaria, sem mandar nada.
// Lógica em _sessionReminderJob.ts, regras em _sessionReminder.ts.

import { isSchedulerCall } from './_auth.js'
import { runSessionReminder } from './_sessionReminderJob.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
const AGENT_SECRET = process.env.AGENT_SECRET

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

export default async function handler(req: Request) {
  const secret = req.headers.get('x-agent-secret')
  if (!(AGENT_SECRET && secret === AGENT_SECRET) && !(await isSchedulerCall(req))) {
    return json({ error: 'Unauthorized' }, 401)
  }
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'Configuração de servidor incompleta' }, 500)
  const dryRun = new URL(req.url).searchParams.get('ensaio') === '1'
  const { status, body } = await runSessionReminder(SUPABASE_URL, SERVICE_KEY, dryRun)
  return json(body, status)
}
