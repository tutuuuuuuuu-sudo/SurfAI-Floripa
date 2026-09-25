import { useId, useMemo, useRef } from 'react'
import { getRatingInfo } from '@/lib/rating'

// "Linha do dia" da página de detalhe de um dia da previsão (ForecastDay.tsx): a nota hora a
// hora desenhada como uma onda contínua, pintada pela cor da nota em cada hora, com o arco do
// sol entre nascer e pôr. Arrastar o dedo (ou setas do teclado) escolhe a hora, e o resto da
// página acompanha. Substituiu o gráfico de barras em 25/set/2026 (usuário achou a página
// "simples demais, falta uma parada mais viva").

export interface CurveHour {
  hour: number
  score: number
}

interface DayCurveProps {
  hours: CurveHour[]
  selectedHour: number
  bestHour: number
  sunriseHour: number | null
  sunsetHour: number | null
  onSelect: (hour: number) => void
  // Só na curva de HOJE (BestWindowWidget): marca "agora" e apaga as horas que já passaram
  nowHour?: number
}

const VW = 360
const VH = 176
const PAD_L = 10
const PAD_R = 10
const ARC_BASE = 44   // linha de base do arco do sol
const TOP = 52        // nota 10 encosta aqui
const BOTTOM = 150    // nota 0 encosta aqui
const TICK_Y = 168

export function DayCurve({ hours, selectedHour, bestHour, sunriseHour, sunsetHour, onSelect, nowHour }: DayCurveProps) {
  const uid = useId().replace(/:/g, '')
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)

  const sunrise = sunriseHour ?? 6
  const sunset = sunsetHour ?? 18
  const isNight = (h: number) => h > sunset || h < sunrise

  const geo = useMemo(() => {
    const first = hours[0]?.hour ?? 0
    const last = hours[hours.length - 1]?.hour ?? 23
    const span = Math.max(1, last - first)
    const x = (h: number) => PAD_L + ((h - first) / span) * (VW - PAD_L - PAD_R)
    const y = (score: number) => BOTTOM - (Math.max(0, Math.min(10, score)) / 10) * (BOTTOM - TOP)
    const pts = hours.map(h => ({ x: x(h.hour), y: y(h.score) }))

    // Catmull-Rom → Bézier: curva suave passando exatamente por cada hora
    let line = pts.length ? `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}` : ''
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2
      const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6
      const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6
      line += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    }
    const area = pts.length
      ? `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${BOTTOM} L ${pts[0].x.toFixed(1)} ${BOTTOM} Z`
      : ''

    // Faixa vertical de cada hora (metade do caminho até a vizinha de cada lado)
    const bands = hours.map((h, i) => {
      const left = i === 0 ? x(h.hour) : (x(hours[i - 1].hour) + x(h.hour)) / 2
      const right = i === hours.length - 1 ? x(h.hour) : (x(h.hour) + x(hours[i + 1].hour)) / 2
      return { hour: h.hour, score: h.score, left, width: Math.max(0, right - left) }
    })

    return { x, y, line, area, bands, first, last }
  }, [hours])

  // Arco do sol: quadrática de nascer a pôr, pico no alto do gráfico
  const sx = geo.x(Math.max(geo.first, sunrise))
  const ex = geo.x(Math.min(geo.last, sunset))
  const ctrlY = 2 * 8 - ARC_BASE // pico em y=8
  const arcPath = `M ${sx.toFixed(1)} ${ARC_BASE} Q ${((sx + ex) / 2).toFixed(1)} ${ctrlY} ${ex.toFixed(1)} ${ARC_BASE}`
  const sunT = (selectedHour - sunrise) / Math.max(1, sunset - sunrise)
  const sunVisible = sunT >= 0 && sunT <= 1
  const sunX = sx + (ex - sx) * sunT
  const sunY = (1 - sunT) ** 2 * ARC_BASE + 2 * (1 - sunT) * sunT * ctrlY + sunT ** 2 * ARC_BASE

  // Horas vizinhas com a mesma cor viram um retângulo só — um por hora deixava emendas
  // verticais visíveis entre elas (antialias da borda de cada retângulo)
  const runs: { left: number; width: number; fill: string; opacity: number }[] = []
  for (const band of geo.bands) {
    const night = isNight(band.hour)
    const past = nowHour !== undefined && band.hour < nowHour
    const fill = night || past ? 'var(--muted-foreground)' : getRatingInfo(band.score).scoreColor
    const opacity = night || past ? 0.14 : band.hour === selectedHour ? 0.7 : 0.4
    const prev = runs[runs.length - 1]
    if (prev && prev.fill === fill && prev.opacity === opacity) prev.width = band.left + band.width - prev.left
    else runs.push({ left: band.left, width: band.width, fill, opacity })
  }

  const selected = hours.find(h => h.hour === selectedHour) ?? hours[0]
  const selInfo = getRatingInfo(selected?.score ?? 0)
  const selX = geo.x(selected?.hour ?? 0)
  const selY = geo.y(selected?.score ?? 0)
  const best = hours.find(h => h.hour === bestHour)

  const hourFromClientX = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || hours.length === 0) return null
    const vx = ((clientX - rect.left) / rect.width) * VW
    let nearest = hours[0].hour, dist = Infinity
    for (const h of hours) {
      const d = Math.abs(geo.x(h.hour) - vx)
      if (d < dist) { dist = d; nearest = h.hour }
    }
    return nearest
  }

  const pick = (clientX: number) => {
    const h = hourFromClientX(clientX)
    if (h !== null && h !== selectedHour) onSelect(h)
  }

  const step = (dir: 1 | -1) => {
    const idx = hours.findIndex(h => h.hour === selectedHour)
    const next = hours[Math.min(hours.length - 1, Math.max(0, idx + dir))]
    if (next) onSelect(next.hour)
  }

  const fmt = (h: number) => `${String(h).padStart(2, '0')}h`

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      width="100%"
      className="block select-none cursor-ew-resize rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={{ touchAction: 'pan-y' }}
      role="slider"
      tabIndex={0}
      aria-label="Hora do dia"
      aria-valuemin={geo.first}
      aria-valuemax={geo.last}
      aria-valuenow={selectedHour}
      aria-valuetext={`${fmt(selectedHour)}, nota ${selected?.score.toFixed(1)} ${selInfo.label}`}
      onPointerDown={e => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); pick(e.clientX) }}
      onPointerMove={e => { if (dragging.current) pick(e.clientX) }}
      onPointerUp={() => { dragging.current = false }}
      onPointerCancel={() => { dragging.current = false }}
      onKeyDown={e => {
        if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
        if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
      }}
    >
      <defs>
        <clipPath id={`area-${uid}`}>
          <path d={geo.area} />
        </clipPath>
      </defs>

      {/* Arco do sol */}
      <path d={arcPath} fill="none" stroke="var(--muted-foreground)" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 4" />
      <text x={sx} y={ARC_BASE + 10} textAnchor="middle" fontSize="8" fill="var(--muted-foreground)">{fmt(sunrise)}</text>
      <text x={ex} y={ARC_BASE + 10} textAnchor="middle" fontSize="8" fill="var(--muted-foreground)">{fmt(sunset)}</text>
      {sunVisible && (
        <g style={{ transform: `translate(${sunX}px, ${sunY}px)`, transition: 'transform 0.25s ease-out' }}>
          <circle r="10" fill="var(--rating-fair)" opacity="0.18" />
          <circle r="5" fill="var(--rating-fair)" />
        </g>
      )}

      {/* Corpo da onda: cada hora pintada com a cor da própria nota; noite apagada */}
      <g clipPath={`url(#area-${uid})`} style={{ animation: 'fadeIn 0.8s ease-out both' }}>
        {runs.map(r => (
          <rect key={r.left} x={r.left} y={TOP - 4} width={r.width} height={BOTTOM - TOP + 4} fill={r.fill} opacity={r.opacity} />
        ))}
      </g>
      <path
        d={geo.line}
        fill="none"
        stroke="var(--foreground)"
        strokeOpacity="0.85"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
        style={{ animation: 'drawLine 1.1s ease-out both' }}
      />
      <line x1={PAD_L} x2={VW - PAD_R} y1={BOTTOM} y2={BOTTOM} stroke="var(--border)" strokeWidth="1" />

      {/* Melhor hora (quando não é a selecionada) */}
      {best && best.hour !== selectedHour && (
        <circle cx={geo.x(best.hour)} cy={geo.y(best.score)} r="3.5" fill="var(--background)" stroke={getRatingInfo(best.score).scoreColor} strokeWidth="2" />
      )}

      {/* Cursor da hora selecionada */}
      <g style={{ transform: `translateX(${selX}px)`, transition: 'transform 0.2s ease-out' }}>
        <line x1="0" x2="0" y1={ARC_BASE + 14} y2={BOTTOM} stroke="var(--foreground)" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 3" />
      </g>
      <g style={{ transform: `translate(${selX}px, ${selY}px)`, transition: 'transform 0.2s ease-out' }}>
        <circle r="9" fill={selInfo.scoreColor} opacity="0.25" />
        <circle r="5" fill={selInfo.scoreColor} stroke="var(--background)" strokeWidth="2" />
      </g>

      {/* Agora */}
      {nowHour !== undefined && nowHour >= geo.first && nowHour <= geo.last && (
        <g>
          <line x1={geo.x(nowHour)} x2={geo.x(nowHour)} y1={BOTTOM} y2={BOTTOM + 5} stroke="var(--foreground)" strokeWidth="2" />
          <text x={geo.x(nowHour)} y={TICK_Y} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--foreground)">agora</text>
        </g>
      )}

      {/* Horas (esconde a que ficaria em cima do "agora") */}
      {hours.filter(h => (h.hour % 6 === 0 || h.hour === geo.last) && (nowHour === undefined || Math.abs(geo.x(h.hour) - geo.x(nowHour)) > 22)).map(h => (
        <text key={h.hour} x={geo.x(h.hour)} y={TICK_Y} textAnchor={h.hour === geo.first ? 'start' : h.hour === geo.last ? 'end' : 'middle'} fontSize="9" fill="var(--muted-foreground)">
          {fmt(h.hour)}
        </text>
      ))}
    </svg>
  )
}
