export const config = { runtime: 'edge' }

// Cron: roda a cada 2h (ver .github/workflows/refresh-windy-cache.yml) e é o ÚNICO
// responsável por manter o cache da Windy quente — 14 praias × 2 chamadas (onda+vento) ×
// 12 execuções/dia = 336 chamadas/dia, folga real sobre o limite de 500/dia do plano
// gratuito da Windy. Antes disso, o cache era só reativo (atualizava quando um usuário
// pedia e o TTL de 15min já tinha expirado) — isso deixava o consumo de cota diretamente
// proporcional ao tráfego, e a cota estourava mais cedo a cada dia conforme o app cresce
// (achado 27/ago/2026: estourou às 09:52 UTC num dia com o dobro de tráfego do dia
// anterior). Com esse cron + TTL bem maior que o intervalo (ver _liveConditions.ts),
// pedido de usuário real não deveria mais disparar chamada própria à Windy em operação
// normal — só lê o que já está em cache.

import { fetchAndCacheWindyRaw } from './_liveConditions.js'
import { BEACH_REGISTRY } from './_beachRegistry.js'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

export default async function handler(req: Request) {
  // Mesmo padrão de autenticação dos outros crons (ver push-notify.ts) — secret em query
  // param, comparado com a env var. Chamado pelo GitHub Actions, nunca pelo frontend.
  const secret = process.env.REFRESH_WINDY_CACHE_SECRET
  const provided = new URL(req.url).searchParams.get('secret')
  if (!secret || provided !== secret) return json({ error: 'Unauthorized' }, 401)

  const resultados = await Promise.all(
    BEACH_REGISTRY.map(async (praia) => {
      try {
        const raw = await fetchAndCacheWindyRaw(String(praia.lat), String(praia.lng))
        return { praia: praia.id, ok: raw !== null }
      } catch (err) {
        console.error('[refresh-windy-cache] falhou pra', praia.id, err)
        return { praia: praia.id, ok: false }
      }
    })
  )

  const falhas = resultados.filter((r) => !r.ok)
  if (falhas.length > 0) {
    console.error('[refresh-windy-cache] praias que falharam:', falhas.map((f) => f.praia).join(', '))
  }
  console.log(`[refresh-windy-cache] ${resultados.length - falhas.length}/${resultados.length} praias atualizadas com sucesso`)

  return json({ atualizadas: resultados.length - falhas.length, total: resultados.length, falhas: falhas.map((f) => f.praia) })
}
