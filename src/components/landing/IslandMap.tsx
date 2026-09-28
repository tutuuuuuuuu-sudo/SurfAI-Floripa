import { useEffect, useRef, useState } from 'react'
import { getRatingInfo } from '@/lib/rating'
import { formatWaveRange, type BeachCondition } from '@/lib/surfData'
import { directionName } from '@/lib/directions'
import { ISLAND_PATH, ISLAND_VIEWBOX } from '@/components/landing/islandShape'
import { useIslandBeaches, type IslandRatingSummary } from '@/components/landing/useIslandBeaches'

// "A ilha inteira, agora": contorno real da ilha (OpenStreetMap) com as 14 praias acesas na cor
// da nota deste momento e a lista de norte a sul. Cada praia mostra quantos picos o app
// acompanha nela (o diferencial que o usuário quer destacar). As fotos das regiões chegaram a
// ficar aqui e saíram a pedido do usuário (29/set/2026): o mapa se explica sozinho, com o selo
// de "tempo real" no título da seção (Landing.tsx).

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

// listOnly: só a lista de praias (na landing o mapa em si já aparece na transição do topo,
// em cima da imagem de satélite — Hero.tsx — e não precisa repetir aqui embaixo)
export function IslandMap({ listOnly = false }: { listOnly?: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { beaches, summary } = useIslandBeaches()

  // Os pontos acendem de norte a sul quando o mapa entra na tela (uma vez só)
  const mapRef = useRef<HTMLDivElement>(null)
  const [lit, setLit] = useState(false)
  useEffect(() => {
    const el = mapRef.current
    if (!el || listOnly) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setLit(true); obs.disconnect() } }, { threshold: 0.3 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [listOnly])

  const selected = beaches.find(b => b.id === selectedId) ?? null
  const pickBeach = (b: BeachCondition) => setSelectedId(prev => (prev === b.id ? null : b.id))

  return (
    <div className="flex flex-col gap-4">
      {!listOnly && <IslandSummary summary={summary} className="text-muted-foreground [&>span:first-child]:text-foreground" />}

      {/* Mapa + lista */}
      <div ref={mapRef} className={listOnly
        ? 'rounded-2xl border border-border/60 bg-card p-3 sm:p-5'
        : 'grid grid-cols-[minmax(0,43%)_minmax(0,1fr)] gap-3 rounded-2xl border border-border/60 bg-card p-3 sm:grid-cols-[minmax(0,32%)_minmax(0,1fr)] sm:gap-6 sm:p-5'}>
        {!listOnly && <svg
          viewBox={`-14 -8 ${ISLAND_VIEWBOX.width + 28} ${ISLAND_VIEWBOX.height + 16}`}
          className="h-auto w-full self-start"
          role="img"
          aria-label="Mapa da Ilha de Santa Catarina com as praias coloridas pela nota de agora"
        >
          <path d={ISLAND_PATH} fill="color-mix(in oklch, var(--foreground) 10%, var(--card))" stroke="color-mix(in oklch, var(--foreground) 30%, transparent)" strokeWidth="1.5" strokeLinejoin="round" />
          {beaches.map((b, i) => {
            const info = getRatingInfo(b.score)
            const active = b.id === selectedId
            return (
              <g key={b.id} onClick={() => pickBeach(b)} className="cursor-pointer">
                {active && (
                  <circle cx={b.pos.x} cy={b.pos.y} r="20" fill={info.scoreColor} opacity="0.25">
                    <animate attributeName="r" values="14;24;14" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={b.pos.x} cy={b.pos.y} r={active ? 13 : 9.5} fill={info.scoreColor} stroke="var(--card)" strokeWidth="3"
                  className={lit ? 'map-dot-in' : 'opacity-0'} style={{ animationDelay: `${i * 90}ms` }} />
                <circle cx={b.pos.x} cy={b.pos.y} r="18" fill="transparent" />
              </g>
            )
          })}
          {/* Nome da praia escolhida numa etiqueta acima do ponto, sempre dentro do desenho
              (antes o nome ia pra esquerda do ponto e cortava na borda: "ampeche") */}
          {selected && (() => {
            const w = selected.name.length * 10.5 + 22
            const minX = -14 + w / 2 + 2, maxX = ISLAND_VIEWBOX.width + 14 - w / 2 - 2
            const cx = Math.min(Math.max(selected.pos.x, minX), maxX)
            const above = selected.pos.y - 34 > 0
            const cy = above ? selected.pos.y - 30 : selected.pos.y + 30
            return (
              <g style={{ animation: 'fadeIn 0.2s ease-out' }} pointerEvents="none">
                <rect x={cx - w / 2} y={cy - 15} width={w} height={30} rx={15} fill="var(--card)" stroke="color-mix(in oklch, var(--foreground) 25%, transparent)" strokeWidth="1.5" />
                <text x={cx} y={cy + 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--foreground)">{selected.name}</text>
              </g>
            )
          })()}
        </svg>}

        <ul className={listOnly ? 'flex flex-col sm:block sm:columns-2 sm:gap-6' : 'flex flex-col'} aria-label="Praias de norte a sul">
          {beaches.length === 0 && Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="my-1 h-7 animate-pulse rounded bg-muted" />
          ))}
          {beaches.map(b => {
            const info = getRatingInfo(b.score)
            const active = b.id === selectedId
            const picos = b.subRegions ?? []
            return (
              <li key={b.id} className="break-inside-avoid">
                <button type="button" onClick={() => pickBeach(b)} aria-expanded={active}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    active ? 'bg-muted' : 'hover:bg-muted/60'
                  }`}>
                  <span className="min-w-0">
                    <span className={`block leading-tight ${active ? 'font-bold' : 'font-medium'}`}>{b.name}</span>
                    {picos.length > 0 && <span className="block text-[11px] leading-tight text-muted-foreground">{picos.length} picos</span>}
                  </span>
                  <span className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums"
                    style={{ color: info.scoreColor, background: `color-mix(in oklch, ${info.scoreColor} 14%, transparent)` }}>
                    {b.score.toFixed(1)}
                  </span>
                </button>
                {active && (
                  <div className="px-2 pb-2 pt-0.5 text-xs leading-relaxed text-muted-foreground" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                    <span className="font-semibold" style={{ color: info.scoreColor }}>{info.label}</span>
                    {' · '}onda {formatWaveRange(b.waveHeight)} · vento {b.windDirection} {directionName(b.windDirection)} {Math.round(b.windSpeed)}km/h · maré {b.tide.toLowerCase()}
                    {picos.length > 0 && <><br />Picos: {picos.map(p => p.name).join(', ')}</>}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {!listOnly && <p className="text-[11px] text-muted-foreground/70">Contorno da ilha: © colaboradores do OpenStreetMap</p>}
    </div>
  )
}
