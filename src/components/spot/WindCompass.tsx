import { WIND_DEG } from '@/lib/surfData'
import { directionName, windEffect, WIND_EFFECT_INFO } from '@/lib/directions'

export const getWindDirectionCode = (d: string) => d.split(' ')[0]
export const formatWindDirection = (d: string) => ({ code: getWindDirectionCode(d), name: directionName(getWindDirectionCode(d)) })
export const directionToDegrees = (d: string): number => WIND_DEG[getWindDirectionCode(d)] ?? 0

// Rosa dos ventos (redesenhada 2x em 25/set/2026). A 1ª versão dividia a rosa em metade
// MAR/metade TERRA — o usuário rejeitou: terral/maral não são dois semicírculos de 180°
// (tem a faixa lateral no meio, ver classifyWind em api/_scoreEngine.ts) e aquilo "não é uma
// rosa dos ventos". Esta é uma rosa clássica: estrela de 16 pontas com faces claro/escuro
// (relevo), anel graduado a cada 10°, 8 direções em português (L/O, SE/SO...). A direção de
// onde o vento VEM acende no anel; a seta atravessa a rosa até pra onde ele vai, com riscos
// correndo na velocidade do vento, na cor do efeito na praia (terral/lateral/maral) quando a
// orientação da praia é conhecida.
const C = 85
const pt = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180
  return { x: C + r * Math.sin(rad), y: C - r * Math.cos(rad) }
}
const P = (p: { x: number; y: number }) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`

// Uma ponta da estrela = duas metades (face clara à esquerda, escura à direita)
function starPoint(deg: number, tip: number, base: number) {
  const t = pt(deg, tip), l = pt(deg - 45, base), r = pt(deg + 45, base), c = { x: C, y: C }
  return { light: `${P(c)} ${P(l)} ${P(t)}`, dark: `${P(c)} ${P(t)} ${P(r)}` }
}

const RING = 64
const LABELS: [number, string, boolean][] = [
  [0, 'N', true], [45, 'NE', false], [90, 'L', true], [135, 'SE', false],
  [180, 'S', true], [225, 'SO', false], [270, 'O', true], [315, 'NO', false],
]

export const WindCompass = ({ direction, speed, orientation }: { direction: string, speed: number, orientation?: number }) => {
  // WIND_DEG guarda a direção de onde o vento VEM (convenção meteorológica padrão —
  // "vento de nordeste" = vem do NE). A seta vai de lá até o lado oposto, pra onde ele sopra.
  const fromDeg = directionToDegrees(direction)
  const code = getWindDirectionCode(direction).toUpperCase()
  const effect = orientation !== undefined ? windEffect(code, orientation) : null
  const effectInfo = effect ? WIND_EFFECT_INFO[effect] : null
  const color = effectInfo?.color
    ?? (speed <= 10 ? 'var(--rating-good)' : speed <= 20 ? 'var(--rating-fair)' : 'var(--rating-poor)')

  const tail = pt(fromDeg, 50)
  const head = pt(fromDeg + 180, 52)
  const headBase = pt(fromDeg + 180, 40)
  const wl = pt(fromDeg + 180 - 90, 6.5), wr = pt(fromDeg + 180 + 90, 6.5)
  const arrowHead = `${P(head)} ${(headBase.x + wl.x - C).toFixed(2)},${(headBase.y + wl.y - C).toFixed(2)} ${(headBase.x + wr.x - C).toFixed(2)},${(headBase.y + wr.y - C).toFixed(2)}`
  // Riscos correm mais rápido com vento mais forte (0.7s a 2.2s por ciclo)
  const flowDuration = Math.max(0.7, 2.2 - speed / 15)

  // Arco aceso no anel: a "fatia" de 22.5° da direção de onde o vento vem
  const a0 = pt(fromDeg - 11.25, RING), a1 = pt(fromDeg + 11.25, RING)
  const litArc = `M ${P(a0)} A ${RING} ${RING} 0 0 1 ${P(a1)}`

  const ticks = Array.from({ length: 36 }, (_, i) => i * 10)

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="164" height="164" viewBox="0 0 170 170" role="img" aria-label={`Vento ${code}, ${directionName(code)}, ${speed}km/h${effectInfo ? `, ${effectInfo.label.toLowerCase()}` : ''}`}>
        {/* Mostrador */}
        <circle cx={C} cy={C} r={RING + 12} fill="var(--muted)" fillOpacity="0.25" />
        <circle cx={C} cy={C} r={RING} fill="var(--card)" stroke="var(--muted-foreground)" strokeOpacity="0.55" strokeWidth="1.2" />
        <circle cx={C} cy={C} r={RING - 9} fill="none" stroke="var(--muted-foreground)" strokeOpacity="0.2" strokeWidth="0.8" />
        <circle cx={C} cy={C} r="22" fill="none" stroke="var(--muted-foreground)" strokeOpacity="0.2" strokeWidth="0.8" strokeDasharray="1.5 3" />

        {/* Graduação a cada 10°, mais longa a cada 30° */}
        {ticks.map(deg => {
          const major = deg % 30 === 0
          const a = pt(deg, RING - (major ? 7 : 4)), b = pt(deg, RING)
          return <line key={deg} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--muted-foreground)" strokeOpacity={major ? 0.85 : 0.45} strokeWidth={major ? 1.3 : 0.8} />
        })}

        {/* Direção de onde o vento vem, acesa no anel */}
        <path d={litArc} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" opacity="0.9" />

        {/* Estrela: 8 pontas secundárias (atrás) + 4 intercardeais + 4 cardeais (na frente) */}
        {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map(d => {
          const sp = starPoint(d, 30, 5)
          return <g key={d}><polygon points={sp.light} fill="var(--muted-foreground)" fillOpacity="0.35" /><polygon points={sp.dark} fill="var(--muted-foreground)" fillOpacity="0.18" /></g>
        })}
        {[45, 135, 225, 315].map(d => {
          const sp = starPoint(d, 40, 8)
          return <g key={d}><polygon points={sp.light} fill="var(--muted-foreground)" fillOpacity="0.7" /><polygon points={sp.dark} fill="var(--muted-foreground)" fillOpacity="0.35" /></g>
        })}
        {[0, 90, 180, 270].map(d => {
          const sp = starPoint(d, 53, 10)
          return <g key={d}><polygon points={sp.light} fill="var(--foreground)" fillOpacity={d === 0 ? 0.95 : 0.8} /><polygon points={sp.dark} fill="var(--foreground)" fillOpacity={d === 0 ? 0.5 : 0.35} /></g>
        })}

        {/* Direções */}
        {LABELS.map(([deg, l, cardinal]) => {
          const p = pt(deg, RING + 12)
          return (
            <text key={l} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
              fontSize={cardinal ? 12 : 8.5} fontWeight={cardinal ? 800 : 600}
              fill={l === 'N' ? 'var(--primary)' : 'var(--foreground)'} fillOpacity={cardinal ? 0.95 : 0.6}>
              {l}
            </text>
          )
        })}

        {/* Seta do vento: de onde vem → pra onde vai (contorno escuro pra destacar da estrela) */}
        <line x1={tail.x} y1={tail.y} x2={headBase.x} y2={headBase.y} stroke="var(--background)" strokeWidth="6.5" strokeLinecap="round" opacity="0.85" />
        <polygon points={arrowHead} fill="var(--background)" stroke="var(--background)" strokeWidth="3" strokeLinejoin="round" opacity="0.85" />
        <line x1={tail.x} y1={tail.y} x2={headBase.x} y2={headBase.y} stroke={color} strokeWidth="3.5" strokeLinecap="round" />
        <line
          x1={tail.x} y1={tail.y} x2={headBase.x} y2={headBase.y}
          stroke="var(--background)" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 9"
          style={{ animation: `windFlow ${flowDuration}s linear infinite` }}
        />
        <polygon points={arrowHead} fill={color} strokeLinejoin="round" />
        <circle cx={tail.x} cy={tail.y} r="4.5" fill={color} stroke="var(--background)" strokeWidth="1.5" />
        <circle cx={C} cy={C} r="3" fill="var(--background)" stroke={color} strokeWidth="1.5" />
      </svg>
      <div className="text-center leading-tight">
        <div className="text-lg font-bold tabular-nums">{speed}<span className="text-xs font-semibold text-muted-foreground"> km/h</span></div>
        <div className="text-xs text-muted-foreground mt-0.5">vento <span className="font-semibold text-foreground">{code}</span> {directionName(code)}</div>
        {effectInfo && (
          <>
            <div className={`mt-2 inline-flex items-center rounded-full border border-current/40 px-2.5 py-0.5 text-xs font-bold ${effectInfo.textCls}`}>
              {effectInfo.label}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">{effectInfo.hint}</div>
          </>
        )}
      </div>
    </div>
  )
}
