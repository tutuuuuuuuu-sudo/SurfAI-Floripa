export const config = { runtime: 'edge' }

// Registro do mar real (01/out/2026): só admin. O dono do app anota o tamanho que viu (ou que o
// boletim.surf mostrou) e a lista volta com o que o app mostrava na mesma praia e hora
// (RPC sea_log_recent, a partir de score_snapshots). Serve pra calibrar a altura de onda
// (api/_beachHeight.ts) com dado real em vez de concorrente.
// GET → últimos registros com a comparação · POST → novo registro

import { verifyToken, isAdminUser } from './_auth.js'
import { BEACH_REGISTRY } from './_beachRegistry.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? ''
const SOURCES = ['eu', 'boletim.surf', 'outro']

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

export default async function handler(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return json({ error: 'Configuração incompleta' }, 500)
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  const auth = token ? await verifyToken(token) : null
  if (!auth?.valid || !auth.userId || !(await isAdminUser(auth.userId))) return json({ error: 'Forbidden' }, 403)
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }

  if (req.method === 'GET') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sea_log_recent`, {
      method: 'POST', headers, body: JSON.stringify({ p_limit: 50 }),
    })
    if (!res.ok) return json({ error: 'Erro ao buscar registros' }, 500)
    return json({ items: await res.json() })
  }

  if (req.method === 'POST') {
    const b = await req.json().catch(() => null) as {
      beachId?: string; observedAt?: string; min?: number; max?: number; source?: string; note?: string
    } | null
    const min = Number(b?.min), max = Number(b?.max)
    const when = b?.observedAt ? new Date(b.observedAt) : null
    if (
      !b || !BEACH_REGISTRY.some(x => x.id === b.beachId) || !when || Number.isNaN(when.getTime())
      || !(min >= 0) || !(max >= min) || max > 10 || !SOURCES.includes(b.source ?? '')
    ) return json({ error: 'Dados inválidos' }, 400)

    const res = await fetch(`${SUPABASE_URL}/rest/v1/sea_observations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        created_by: auth.userId,
        beach_id: b.beachId,
        observed_at: when.toISOString(),
        height_min: Math.round(min * 10) / 10,
        height_max: Math.round(max * 10) / 10,
        source: b.source,
        note: b.note?.slice(0, 300) || null,
      }),
    })
    if (!res.ok) return json({ error: 'Erro ao salvar' }, 500)
    return json({ ok: true })
  }

  return json({ error: 'Method not allowed' }, 405)
}
