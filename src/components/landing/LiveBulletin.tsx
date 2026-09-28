import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUp } from 'lucide-react'
import { useSurfData } from '@/contexts/SurfDataContext'
import { getRatingInfo } from '@/lib/rating'
import { formatWaveRange, WIND_DEG } from '@/lib/surfData'
import { directionName } from '@/lib/directions'
import { BEACH_DIRECTORY } from '@/lib/beachDirectory'

// Topo da landing como "boletim do mar de agora" (landing v2, 28/set/2026): em vez de
// prometer "dados em tempo real" num slogan, mostra o dado real deste momento — quantas
// praias estão boas e qual é a melhor, com onda, vento e maré. Usa o mesmo SurfDataContext
// do app (dados públicos, sem login). Enquanto carrega (ou se falhar), cai num título
// fixo honesto em vez de número inventado.

const GOOD_BARS = getRatingInfo(5.5).bars // "BOM" ou melhor, sem repetir o corte de rating.ts
const TOTAL = BEACH_DIRECTORY.length

function headline(goodCount: number | null) {
  if (goodCount === null) return 'O mar de Floripa, praia por praia.'
  if (goodCount === 0) return 'Hoje o mar tá fraco em Floripa.'
  if (goodCount === 1) return 'Agora o mar tá bom em 1 praia.'
  return `Agora o mar tá bom em ${goodCount} praias.`
}

export function LiveBulletin() {
  const { conditions, loading, lastUpdated } = useSurfData()
  const ready = !loading && conditions.length > 0
  const best = ready ? [...conditions].sort((a, b) => b.score - a.score)[0] : null
  const goodCount = ready ? conditions.filter(c => getRatingInfo(c.score).bars >= GOOD_BARS).length : null
  const info = best ? getRatingInfo(best.score) : null
  const time = (lastUpdated ?? new Date()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  const windDeg = best ? WIND_DEG[best.windDirection.toUpperCase()] : undefined

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 text-center sm:max-w-2xl">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rating-good opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-rating-good" />
        </span>
        Boletim de agora{ready ? ` · ${time}` : ''}
      </p>

      <div className="flex flex-col gap-3">
        <h1 className="text-[2.6rem] font-black leading-[1.05] tracking-tight text-white text-balance sm:text-6xl">
          {headline(goodCount)}
        </h1>
        <p className="mx-auto max-w-md text-base leading-relaxed text-white/90 sm:max-w-lg sm:text-lg">
          {best && goodCount !== null && goodCount > 0
            ? <>A melhor agora é <strong className="font-bold text-white">{best.name}</strong>. A gente lê o mar das {TOTAL} praias da ilha o dia inteiro e te mostra onde vale ir.</>
            : <>A gente lê o mar das {TOTAL} praias da ilha o dia inteiro e te mostra onde vale ir, e quando.</>}
        </p>
      </div>

      {/* Cartão do boletim — fundo sólido do tema pra ler bem sobre qualquer parte da foto */}
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/95 p-4 text-left shadow-2xl backdrop-blur-sm">
        {best && info ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Melhor praia agora</div>
                <div className="truncate text-lg font-bold text-foreground">{best.name}</div>
              </div>
              <div className="flex shrink-0 items-baseline gap-1.5">
                <span className="text-3xl font-black tabular-nums" style={{ color: info.scoreColor }}>{best.score.toFixed(1)}</span>
                <span className="text-xs font-bold" style={{ color: info.scoreColor }}>{info.label}</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 divide-x divide-border/60 border-t border-border/60 pt-3 text-sm">
              <div className="pr-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Onda</div>
                <div className="font-bold tabular-nums text-foreground">{formatWaveRange(best.waveHeight)}</div>
              </div>
              <div className="px-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Vento</div>
                <div className="flex items-center gap-1 font-bold tabular-nums text-foreground">
                  {windDeg !== undefined && (
                    <ArrowUp className="h-3.5 w-3.5 shrink-0 text-primary" style={{ transform: `rotate(${windDeg + 180}deg)` }} aria-hidden="true" />
                  )}
                  {Math.round(best.windSpeed)}km/h
                </div>
                <div className="text-[11px] leading-tight text-muted-foreground">{best.windDirection} {directionName(best.windDirection)}</div>
              </div>
              <div className="pl-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Maré</div>
                <div className="font-bold text-foreground">{best.tide.toLowerCase()}</div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2" aria-label="Carregando o boletim">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-6 w-44 animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
        )}
      </div>

      <Link
        to="/login"
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-bold text-primary-foreground transition-transform hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto"
      >
        Ver as {TOTAL} praias grátis
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
