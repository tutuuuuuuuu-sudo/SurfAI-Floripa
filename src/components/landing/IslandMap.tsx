import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { useSurfData } from '@/contexts/SurfDataContext'
import { getRatingInfo } from '@/lib/rating'
import { formatWaveRange, type BeachCondition } from '@/lib/surfData'
import { directionName } from '@/lib/directions'
import { ISLAND_PATH, ISLAND_VIEWBOX, projectLatLng } from '@/components/landing/islandShape'
import photoNorte from '@/assets/landing/directory-norte.jpg'
import photoCentro from '@/assets/landing/directory-centro.jpg'
import photoSul from '@/assets/landing/directory-sul.jpg'

// "A ilha inteira": contorno real da ilha (OpenStreetMap) com as 14 praias acesas na cor da
// nota deste momento, a lista de norte a sul e a foto da região escolhida (versão juntada da
// landing, 28/set/2026 — o usuário gostou do mapa da v2 mas sentiu falta das fotos das
// regiões, então elas voltaram aqui dentro, sem alongar a página). Cada praia mostra também
// quantos picos o app acompanha nela: é o diferencial que o usuário quer destacar ("todas as
// praias de Floripa, incluindo os picos de cada praia").
// As fotos são reais (escolhidas pelo usuário em 18/ago/2026), mas o par foto↔região é só
// estético: nenhuma tem praia específica confirmada, então nunca dizer "essa é a praia X".

type Region = BeachCondition['region']
const REGIONS: Region[] = ['Norte', 'Centro', 'Sul']
const REGION_PHOTO: Record<Region, string> = { Norte: photoNorte, Centro: photoCentro, Sul: photoSul }

// Amostras de cada faixa pra legenda — só lê o rótulo/cor de getRatingInfo, sem repetir os cortes
const LEGEND = [9, 7.5, 6, 4.5, 2].map(s => getRatingInfo(s))

export function IslandMap() {
  const { conditions } = useSurfData()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pickedRegion, setPickedRegion] = useState<Region | null>(null)

  // Os pontos acendem de norte a sul quando o mapa entra na tela (uma vez só)
  const mapRef = useRef<HTMLDivElement>(null)
  const [lit, setLit] = useState(false)
  useEffect(() => {
    const el = mapRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setLit(true); obs.disconnect() } }, { threshold: 0.3 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const beaches = useMemo(
    () => [...conditions].sort((a, b) => b.lat - a.lat).map(c => ({ ...c, pos: projectLatLng(c.lat, c.lng) })),
    [conditions]
  )
  const bestOverall = useMemo(() => [...beaches].sort((a, b) => b.score - a.score)[0], [beaches])
  // Abre na região da melhor praia de agora
  const region: Region = pickedRegion ?? bestOverall?.region ?? 'Centro'
  const regionBeaches = beaches.filter(b => b.region === region)
  const regionBest = [...regionBeaches].sort((a, b) => b.score - a.score)[0]

  const summary = useMemo(() => {
    const counts = new Map<string, number>()
    for (const b of beaches) {
      const label = getRatingInfo(b.score).label
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return LEGEND.filter(l => counts.has(l.label)).map(l => ({ ...l, n: counts.get(l.label)! }))
  }, [beaches])

  const selected = beaches.find(b => b.id === selectedId) ?? null
  const pickBeach = (b: BeachCondition) => {
    setSelectedId(prev => (prev === b.id ? null : b.id))
    setPickedRegion(b.region)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Regiões */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-border/60 bg-card/60 p-1" role="tablist" aria-label="Região da ilha">
          {REGIONS.map(r => (
            <button key={r} type="button" role="tab" aria-selected={r === region}
              onClick={() => { setPickedRegion(r); setSelectedId(null) }}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                r === region ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {r}
            </button>
          ))}
        </div>
        {summary.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {summary.map(s => (
              <span key={s.label} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: s.scoreColor }} />
                {s.n} {s.label.toLowerCase()}
              </span>
            ))}
          </p>
        )}
      </div>

      {/* Foto da região */}
      <div className="relative h-44 overflow-hidden rounded-2xl border border-border/50 sm:h-56">
        {REGIONS.map(r => (
          <img key={r} src={REGION_PHOTO[r]} alt={`Praias da região ${r} de Florianópolis`} loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
            style={{ opacity: r === region ? 1 : 0 }} />
        ))}
        <div className="pointer-events-none absolute inset-0" style={{ background: 'color-mix(in oklch, var(--color-background) 25%, transparent)' }} />
        <div className="pointer-events-none absolute inset-0 region-photo-fade" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-bold"><MapPin className="h-4 w-4 text-primary" />{region} da ilha</div>
            <div className="text-xs text-muted-foreground">{regionBeaches.length} {regionBeaches.length === 1 ? 'praia' : 'praias'}</div>
          </div>
          {regionBest && (
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Melhor agora</div>
              <div className="text-sm font-bold">
                {regionBest.name} <span className="tabular-nums" style={{ color: getRatingInfo(regionBest.score).scoreColor }}>{regionBest.score.toFixed(1)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mapa + lista */}
      <div ref={mapRef} className="grid grid-cols-[minmax(0,43%)_minmax(0,1fr)] gap-3 rounded-2xl border border-border/60 bg-card p-3 sm:grid-cols-[minmax(0,32%)_minmax(0,1fr)] sm:gap-6 sm:p-5">
        <svg
          viewBox={`-14 -8 ${ISLAND_VIEWBOX.width + 28} ${ISLAND_VIEWBOX.height + 16}`}
          className="h-auto w-full self-start"
          role="img"
          aria-label="Mapa da Ilha de Santa Catarina com as praias coloridas pela nota de agora"
        >
          <path d={ISLAND_PATH} fill="color-mix(in oklch, var(--foreground) 10%, var(--card))" stroke="color-mix(in oklch, var(--foreground) 30%, transparent)" strokeWidth="1.5" strokeLinejoin="round" />
          {beaches.map((b, i) => {
            const info = getRatingInfo(b.score)
            const active = b.id === selectedId
            const inRegion = b.region === region
            return (
              <g key={b.id} onClick={() => pickBeach(b)} className="cursor-pointer"
                style={{ opacity: inRegion ? 1 : 0.3, transition: 'opacity 0.4s' }}>
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
          {selected && (
            <text x={selected.pos.x - 18} y={selected.pos.y + 5} textAnchor="end" fontSize="19" fontWeight="700" fill="var(--foreground)"
              paintOrder="stroke" stroke="var(--card)" strokeWidth="5">
              {selected.name}
            </text>
          )}
        </svg>

        <ul className="flex flex-col" aria-label="Praias de norte a sul">
          {beaches.length === 0 && Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="my-1 h-7 animate-pulse rounded bg-muted" />
          ))}
          {beaches.map(b => {
            const info = getRatingInfo(b.score)
            const active = b.id === selectedId
            const picos = b.subRegions ?? []
            return (
              <li key={b.id} style={{ opacity: b.region === region ? 1 : 0.45, transition: 'opacity 0.4s' }}>
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

      <p className="text-[11px] text-muted-foreground/70">Contorno da ilha: © colaboradores do OpenStreetMap</p>
    </div>
  )
}
