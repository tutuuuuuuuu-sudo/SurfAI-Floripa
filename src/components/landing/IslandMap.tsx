import { useMemo, useState } from 'react'
import { useSurfData } from '@/contexts/SurfDataContext'
import { getRatingInfo } from '@/lib/rating'
import { formatWaveRange } from '@/lib/surfData'
import { directionName } from '@/lib/directions'
import { ISLAND_PATH, ISLAND_VIEWBOX, projectLatLng } from '@/components/landing/islandShape'

// "A ilha inteira" (landing v2, 28/set/2026): contorno real da ilha (OpenStreetMap) com as
// 14 praias acesas na cor da nota deste momento, e a lista de norte a sul do lado. Tocar numa
// praia (na lista ou no mapa) destaca ela e mostra onda, vento e maré. Substituiu os 3 cards de
// foto por região + a faixa de números ("24/7", "3 regiões") — aqui a cobertura se prova
// sozinha, com dado real, em vez de ser anunciada.

// Amostras de cada faixa pra legenda — só lê o rótulo/cor de getRatingInfo, sem repetir os cortes
const LEGEND = [9, 7.5, 6, 4.5, 2].map(s => getRatingInfo(s))

export function IslandMap() {
  const { conditions } = useSurfData()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const beaches = useMemo(
    () => [...conditions].sort((a, b) => b.lat - a.lat).map(c => ({ ...c, pos: projectLatLng(c.lat, c.lng) })),
    [conditions]
  )
  const summary = useMemo(() => {
    const counts = new Map<string, number>()
    for (const b of beaches) {
      const label = getRatingInfo(b.score).label
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return LEGEND.filter(l => counts.has(l.label)).map(l => ({ ...l, n: counts.get(l.label)! }))
  }, [beaches])

  const selected = beaches.find(b => b.id === selectedId) ?? null
  const toggle = (id: string) => setSelectedId(prev => (prev === id ? null : id))

  return (
    <div className="flex flex-col gap-4">
      {summary.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Agora:</span>
          {summary.map(s => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.scoreColor }} />
              {s.n} {s.label.toLowerCase()}
            </span>
          ))}
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,43%)_minmax(0,1fr)] sm:grid-cols-[minmax(0,32%)_minmax(0,1fr)] gap-3 rounded-2xl border border-border/60 bg-card p-3 sm:gap-6 sm:p-5">
        {/* Mapa */}
        <svg
          viewBox={`-14 -8 ${ISLAND_VIEWBOX.width + 28} ${ISLAND_VIEWBOX.height + 16}`}
          className="h-auto w-full self-start"
          role="img"
          aria-label="Mapa da Ilha de Santa Catarina com as praias coloridas pela nota de agora"
        >
          <path d={ISLAND_PATH} fill="color-mix(in oklch, var(--foreground) 10%, var(--card))" stroke="color-mix(in oklch, var(--foreground) 30%, transparent)" strokeWidth="1.5" strokeLinejoin="round" />
          {beaches.map(b => {
            const info = getRatingInfo(b.score)
            const active = b.id === selectedId
            return (
              <g key={b.id} onClick={() => toggle(b.id)} className="cursor-pointer">
                {active && (
                  <circle cx={b.pos.x} cy={b.pos.y} r="20" fill={info.scoreColor} opacity="0.25">
                    <animate attributeName="r" values="14;24;14" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={b.pos.x} cy={b.pos.y} r={active ? 13 : 9.5} fill={info.scoreColor} stroke="var(--card)" strokeWidth="3" />
                {/* área de toque maior que o ponto */}
                <circle cx={b.pos.x} cy={b.pos.y} r="18" fill="transparent" />
              </g>
            )
          })}
          {selected && (
            <text x={selected.pos.x - 18} y={selected.pos.y + 4} textAnchor="end" fontSize="19" fontWeight="700" fill="var(--foreground)"
              paintOrder="stroke" stroke="var(--card)" strokeWidth="5">
              {selected.name}
            </text>
          )}
        </svg>

        {/* Lista de norte a sul */}
        <ul className="flex flex-col" aria-label="Praias de norte a sul">
          {beaches.length === 0 && Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="my-1 h-7 animate-pulse rounded bg-muted" />
          ))}
          {beaches.map(b => {
            const info = getRatingInfo(b.score)
            const active = b.id === selectedId
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => toggle(b.id)}
                  aria-expanded={active}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    active ? 'bg-muted' : 'hover:bg-muted/60'
                  }`}
                >
                  <span className={`leading-tight ${active ? 'font-bold' : 'font-medium'}`}>{b.name}</span>
                  <span className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums"
                    style={{ color: info.scoreColor, background: `color-mix(in oklch, ${info.scoreColor} 14%, transparent)` }}>
                    {b.score.toFixed(1)}
                  </span>
                </button>
                {active && (
                  <div className="px-2 pb-2 pt-0.5 text-xs leading-relaxed text-muted-foreground" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                    <span className="font-semibold" style={{ color: info.scoreColor }}>{info.label}</span>
                    {' · '}onda {formatWaveRange(b.waveHeight)} · vento {b.windDirection} {directionName(b.windDirection)} {Math.round(b.windSpeed)}km/h · maré {b.tide.toLowerCase()}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <p className="text-[11px] text-muted-foreground/70">Contorno da ilha: © colaboradores do OpenStreetMap</p>
    </div>
  )
}
