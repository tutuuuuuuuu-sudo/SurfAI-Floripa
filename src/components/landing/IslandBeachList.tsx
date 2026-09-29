import { getRatingInfo } from '@/lib/rating'
import { formatWaveRange } from '@/lib/surfData'
import { directionName } from '@/lib/directions'
import type { IslandBeach, IslandRatingSummary } from '@/components/landing/useIslandBeaches'

// Lista de praias de norte a sul + resumo "Agora na ilha", no fim da transição do topo da landing
// (Hero.tsx), ao lado do mapa de satélite. O palco é sempre escuro (imagem de satélite) nos dois
// temas, por isso o texto é claro fixo. Cada praia mostra quantos picos o app acompanha nela (o
// diferencial que o usuário quer destacar); tocar numa praia marca ela no mapa.

export function IslandSummary({ summary, className = '' }: { summary: IslandRatingSummary; className?: string }) {
  if (summary.length === 0) return null
  return (
    <p className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs ${className}`}>
      <span className="font-semibold">Agora na ilha:</span>
      {summary.map(s => (
        <span key={s.label} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: s.scoreColor }} />
          {s.n} {s.label.toLowerCase()}
        </span>
      ))}
    </p>
  )
}

export function IslandBeachList({ beaches, selectedId, onPick }: {
  beaches: IslandBeach[]
  selectedId: string | null
  onPick: (id: string) => void
}) {
  return (
    <ul className="flyover-panel flex flex-col rounded-2xl p-1.5 text-white" aria-label="Praias de norte a sul">
      {beaches.length === 0 && Array.from({ length: 10 }, (_, i) => (
        <li key={i} className="m-1 h-7 animate-pulse rounded bg-white/10" />
      ))}
      {beaches.map(b => {
        const info = getRatingInfo(b.score)
        const active = b.id === selectedId
        const picos = b.subRegions ?? []
        return (
          <li key={b.id}>
            <button type="button" onClick={() => onPick(b.id)} aria-expanded={active}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                active ? 'bg-white/15' : 'hover:bg-white/10'
              }`}>
              <span className="min-w-0">
                <span className={`block truncate leading-tight ${active ? 'font-bold' : 'font-medium'}`}>{b.name}</span>
                {picos.length > 0 && <span className="block text-[11px] leading-tight text-white/60">{picos.length} picos</span>}
              </span>
              <span className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums"
                style={{ color: info.scoreColor, background: `color-mix(in oklch, ${info.scoreColor} 18%, transparent)` }}>
                {b.score.toFixed(1)}
              </span>
            </button>
            {active && (
              <div className="px-2 pb-2 pt-0.5 text-xs leading-relaxed text-white/75" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                <span className="font-semibold" style={{ color: info.scoreColor }}>{info.label}</span>
                {' · '}onda {formatWaveRange(b.waveHeight)} · vento {b.windDirection} {directionName(b.windDirection)} {Math.round(b.windSpeed)}km/h · maré {b.tide.toLowerCase()}
                {picos.length > 0 && <><br />Picos: {picos.map(p => p.name).join(', ')}</>}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
