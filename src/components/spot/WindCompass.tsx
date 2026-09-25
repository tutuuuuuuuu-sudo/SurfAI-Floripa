import { WIND_DEG } from '@/lib/surfData'
import { directionName, windEffect, WIND_EFFECT_INFO } from '@/lib/directions'

export const getWindDirectionCode = (d: string) => d.split(' ')[0]
export const formatWindDirection = (d: string) => ({ code: getWindDirectionCode(d), name: directionName(getWindDirectionCode(d)) })
export const directionToDegrees = (d: string): number => WIND_DEG[getWindDirectionCode(d)] ?? 0

// Rosa dos ventos redesenhada em 25/set/2026 (usuário: "está quase invisível, só dá pra ver
// a linha amarela e o número"). Novidades: anel e letras com contraste de verdade; quando a
// praia é conhecida (`orientation`), a rosa pinta o lado do MAR e o da TERRA daquela praia,
// então dá pra ver de cara se o vento vem da terra (terral) ou do mar (maral) sem saber
// nada de graus; a seta atravessa a rosa inteira (de onde vem → pra onde vai), com riscos
// correndo por ela na velocidade do vento, e pega a cor do efeito (terral/lateral/maral).
const C = 80
const pt = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180
  return { x: C + r * Math.sin(rad), y: C - r * Math.cos(rad) }
}

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
  const head = pt(fromDeg + 180, 50)
  const headBase = pt(fromDeg + 180, 38)
  const wingL = pt(fromDeg + 180 - 90, 7)
  const wingR = pt(fromDeg + 180 + 90, 7)
  const arrowHead = `${head.x},${head.y} ${headBase.x + wingL.x - C},${headBase.y + wingL.y - C} ${headBase.x + wingR.x - C},${headBase.y + wingR.y - C}`
  // Riscos correm mais rápido com vento mais forte (0.7s a 2.2s por ciclo)
  const flowDuration = Math.max(0.7, 2.2 - speed / 15)

  const seaA = orientation !== undefined ? pt(orientation - 90, 60) : null
  const seaB = orientation !== undefined ? pt(orientation + 90, 60) : null
  const seaLabel = orientation !== undefined ? pt(orientation, 32) : null
  const landLabel = orientation !== undefined ? pt(orientation + 180, 32) : null

  const ticks = Array.from({ length: 16 }, (_, i) => i * 22.5)
  const cardinals: [number, string][] = [[0, 'N'], [90, 'L'], [180, 'S'], [270, 'O']]

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="150" height="150" viewBox="0 0 160 160" role="img" aria-label={`Vento ${code}, ${directionName(code)}, ${speed}km/h${effectInfo ? `, ${effectInfo.label.toLowerCase()}` : ''}`}>
        <circle cx={C} cy={C} r="60" fill="var(--muted)" fillOpacity="0.35" />
        {seaA && seaB && seaLabel && landLabel && (
          <>
            {/* Metade do mar (pra onde a praia olha) e metade da terra */}
            <path d={`M ${seaA.x} ${seaA.y} A 60 60 0 0 1 ${seaB.x} ${seaB.y} Z`} fill="var(--primary)" fillOpacity="0.2" />
            <path d={`M ${seaB.x} ${seaB.y} A 60 60 0 0 1 ${seaA.x} ${seaA.y} Z`} fill="var(--rating-fair)" fillOpacity="0.08" />
            <line x1={seaA.x} y1={seaA.y} x2={seaB.x} y2={seaB.y} stroke="var(--primary)" strokeOpacity="0.55" strokeWidth="1.5" />
            <text x={seaLabel.x} y={seaLabel.y} textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="700" letterSpacing="1.5" fill="var(--primary)">MAR</text>
            <text x={landLabel.x} y={landLabel.y} textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="700" letterSpacing="1.5" fill="var(--muted-foreground)">TERRA</text>
          </>
        )}
        <circle cx={C} cy={C} r="60" fill="none" stroke="var(--muted-foreground)" strokeOpacity="0.5" strokeWidth="1.2" />
        {ticks.map(deg => {
          const cardinal = deg % 90 === 0, main = deg % 45 === 0
          const a = pt(deg, cardinal ? 51 : main ? 54 : 56), b = pt(deg, 60)
          return <line key={deg} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--muted-foreground)" strokeOpacity={cardinal ? 0.9 : main ? 0.65 : 0.4} strokeWidth={cardinal ? 1.8 : 1} />
        })}
        {cardinals.map(([deg, l]) => {
          const p = pt(deg, 71)
          return <text key={l} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize="10.5" fontWeight={l === 'N' ? 800 : 600} fill="var(--foreground)" fillOpacity={l === 'N' ? 0.95 : 0.7}>{l}</text>
        })}

        {/* Seta do vento: de onde vem → pra onde vai */}
        <line x1={tail.x} y1={tail.y} x2={headBase.x} y2={headBase.y} stroke={color} strokeWidth="3.5" strokeLinecap="round" />
        <line
          x1={tail.x} y1={tail.y} x2={headBase.x} y2={headBase.y}
          stroke="var(--background)" strokeOpacity="0.55" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 9"
          style={{ animation: `windFlow ${flowDuration}s linear infinite` }}
        />
        <polygon points={arrowHead} fill={color} strokeLinejoin="round" />
        <circle cx={tail.x} cy={tail.y} r="4" fill={color} />
      </svg>
      <div className="text-center leading-tight">
        <div className="text-lg font-bold tabular-nums">{speed}<span className="text-xs font-semibold text-muted-foreground"> km/h</span></div>
        <div className="text-xs text-muted-foreground mt-0.5"><span className="font-semibold text-foreground">{code}</span> · {directionName(code)}</div>
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
