import { useId, useMemo, useRef, useState } from 'react'
import { smoothPath } from '@/lib/chartPath'

// Maré do dia no mesmo estilo "vivo" da curva do dia (DayCurve.tsx) — pedido do usuário em
// 25/set/2026: arrastar pela curva e ir vendo hora, nível e se está enchendo/secando.
// Usado em SpotDetails (via TideChart, com marcador "agora") e em ForecastDay (ligado à hora
// escolhida na curva do dia: arrastar um move o outro).
interface DayTideChartProps {
  heights: number[]        // nível por hora (index 0 = 00h), pelo menos ~20 valores
  selectedHour?: number    // controlado de fora (ForecastDay); sem isso, controla sozinho
  onSelect?: (hour: number) => void
  nowHour?: number         // marca "agora" (só no dia de hoje)
}

const VW = 360
const VH = 156
const PAD_L = 10
const PAD_R = 10
const TOP = 34      // maré mais alta encosta aqui (sobra espaço pro rótulo "Alta")
const BOTTOM = 112  // maré mais baixa encosta aqui (sobra espaço pro rótulo "Baixa")
const AXIS = 132    // linha de base
const TICK_Y = 148

const fmt = (h: number) => `${String(h).padStart(2, '0')}h`

export function DayTideChart({ heights, selectedHour, onSelect, nowHour }: DayTideChartProps) {
  const uid = useId().replace(/:/g, '')
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const [ownHour, setOwnHour] = useState<number | null>(null)

  const n = Math.min(heights.length, 25)
  const last = n - 1
  const geo = useMemo(() => {
    const hs = heights.slice(0, n)
    const min = Math.min(...hs), max = Math.max(...hs)
    const span = Math.max(0.05, max - min)
    const x = (h: number) => PAD_L + (h / Math.max(1, last)) * (VW - PAD_L - PAD_R)
    const y = (v: number) => BOTTOM - ((v - min) / span) * (BOTTOM - TOP)
    const pts = hs.map((v, i) => ({ x: x(i), y: y(v) }))
    const line = smoothPath(pts)
    const area = `${line} L ${x(last).toFixed(1)} ${AXIS} L ${x(0).toFixed(1)} ${AXIS} Z`

    // Picos (alta) e vales (baixa) no dado horário cru — >=/<= pra não perder o evento
    // quando dois vizinhos empatam no arredondamento (achado 24/set/2026)
    const mid = (max + min) / 2, amp = span / 2
    const events: { hour: number; type: 'alta' | 'baixa'; v: number }[] = []
    for (let i = 1; i < hs.length - 1; i++) {
      const p = hs[i - 1], c = hs[i], nx = hs[i + 1]
      const prev = events[events.length - 1]
      if (c >= p && c >= nx && c > mid + amp * 0.15 && !(prev?.type === 'alta' && i - prev.hour <= 1)) events.push({ hour: i, type: 'alta', v: c })
      if (c <= p && c <= nx && c < mid - amp * 0.15 && !(prev?.type === 'baixa' && i - prev.hour <= 1)) events.push({ hour: i, type: 'baixa', v: c })
    }
    return { x, y, line, area, events, hs }
  }, [heights, n, last])

  if (heights.length < 20) return null

  const sel = Math.max(0, Math.min(last, selectedHour ?? ownHour ?? nowHour ?? 12))
  const select = (h: number) => { if (onSelect) onSelect(h); else setOwnHour(h) }
  const selV = geo.hs[sel]
  const nextV = geo.hs[sel + 1]
  const trend = nextV === undefined ? null : nextV > selV + 0.02 ? 'enchendo' : nextV < selV - 0.02 ? 'secando' : 'parada'
  const selX = geo.x(sel), selY = geo.y(selV)
  const nextEvent = geo.events.find(e => e.hour > sel)

  const pick = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const vx = ((clientX - rect.left) / rect.width) * VW
    const h = Math.round(((vx - PAD_L) / (VW - PAD_L - PAD_R)) * last)
    const clamped = Math.max(0, Math.min(last, h))
    if (clamped !== sel) select(clamped)
  }

  return (
    <div>
      {/* Leitura da hora escolhida */}
      <div className="flex items-end justify-between gap-3 px-1 pb-1">
        <div key={sel} style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div className="text-xs text-muted-foreground">{nowHour !== undefined && sel === nowHour ? 'Agora' : `Às ${fmt(sel)}`}</div>
          <div className="text-xl font-bold tabular-nums">
            {selV.toFixed(2)}m
            {trend && <span className="ml-1.5 text-xs font-semibold text-primary">{trend}</span>}
          </div>
        </div>
        {nextEvent && (
          <div className="text-right text-xs text-muted-foreground">
            próxima {nextEvent.type}
            <div className={`text-sm font-bold tabular-nums ${nextEvent.type === 'alta' ? 'text-rating-good' : 'text-rating-fair'}`}>{fmt(nextEvent.hour)}</div>
          </div>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        className="block select-none cursor-ew-resize rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        style={{ touchAction: 'pan-y' }}
        role="slider"
        tabIndex={0}
        aria-label="Hora da maré"
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={sel}
        aria-valuetext={`${fmt(sel)}, maré ${selV.toFixed(2)} metros${trend ? `, ${trend}` : ''}`}
        onPointerDown={e => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); pick(e.clientX) }}
        onPointerMove={e => { if (dragging.current) pick(e.clientX) }}
        onPointerUp={() => { dragging.current = false }}
        onPointerCancel={() => { dragging.current = false }}
        onKeyDown={e => {
          if (e.key === 'ArrowRight') { e.preventDefault(); select(Math.min(last, sel + 1)) }
          if (e.key === 'ArrowLeft') { e.preventDefault(); select(Math.max(0, sel - 1)) }
        }}
      >
        <defs>
          <clipPath id={`tide-${uid}`}><path d={geo.area} /></clipPath>
        </defs>

        {/* Água: corpo da curva, mais forte até a hora escolhida */}
        <g clipPath={`url(#tide-${uid})`} style={{ animation: 'fadeIn 0.8s ease-out both' }}>
          <rect x="0" y={TOP - 10} width={VW} height={AXIS - TOP + 10} fill="var(--primary)" opacity="0.14" />
          <rect x="0" y={TOP - 10} width={selX} height={AXIS - TOP + 10} fill="var(--primary)" opacity="0.2" style={{ transition: 'width 0.2s ease-out' }} />
        </g>
        <path
          d={geo.line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1"
          style={{ animation: 'drawLine 1.1s ease-out both' }}
        />
        <line x1={PAD_L} x2={VW - PAD_R} y1={AXIS} y2={AXIS} stroke="var(--border)" strokeWidth="1" />

        {/* Alta e baixa */}
        {geo.events.map(ev => {
          const ex = geo.x(ev.hour), ey = geo.y(ev.v), high = ev.type === 'alta'
          const lx = Math.min(Math.max(ex, PAD_L + 26), VW - PAD_R - 26)
          const c = high ? 'var(--rating-good)' : 'var(--rating-fair)'
          return (
            <g key={`${ev.type}${ev.hour}`}>
              <circle cx={ex} cy={ey} r="3.5" fill={c} />
              <text x={lx} y={high ? ey - 9 : ey + 15} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={c}>
                {high ? 'Alta' : 'Baixa'} {fmt(ev.hour)}
              </text>
            </g>
          )
        })}

        {/* Cursor */}
        <g style={{ transform: `translateX(${selX}px)`, transition: 'transform 0.2s ease-out' }}>
          <line x1="0" x2="0" y1={TOP - 12} y2={AXIS} stroke="var(--foreground)" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 3" />
        </g>
        <g style={{ transform: `translate(${selX}px, ${selY}px)`, transition: 'transform 0.2s ease-out' }}>
          <circle r="9" fill="var(--primary)" opacity="0.25" />
          <circle r="5" fill="var(--primary)" stroke="var(--background)" strokeWidth="2" />
        </g>

        {/* Agora */}
        {nowHour !== undefined && nowHour >= 0 && nowHour <= last && (
          <g>
            <line x1={geo.x(nowHour)} x2={geo.x(nowHour)} y1={AXIS} y2={AXIS + 5} stroke="var(--foreground)" strokeWidth="2" />
            <text x={geo.x(nowHour)} y={TICK_Y} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--foreground)">agora</text>
          </g>
        )}

        {/* Horas */}
        {[0, 6, 12, 18, last]
          .filter((h, i, arr) => arr.indexOf(h) === i && (nowHour === undefined || Math.abs(geo.x(h) - geo.x(nowHour)) > 22))
          .map(h => (
            <text key={h} x={geo.x(h)} y={TICK_Y} textAnchor={h === 0 ? 'start' : h === last ? 'end' : 'middle'} fontSize="9" fill="var(--muted-foreground)">
              {fmt(h === 24 ? 0 : h)}
            </text>
          ))}
      </svg>
    </div>
  )
}
