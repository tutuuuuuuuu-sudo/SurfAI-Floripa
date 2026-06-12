import { WIND_DEG } from '@/lib/surfData'

const directionNames: Record<string, string> = {
  'N': 'Norte', 'NNE': 'Nordeste', 'NE': 'Nordeste', 'ENE': 'Nordeste',
  'E': 'Leste', 'ESE': 'Sudeste', 'SE': 'Sudeste', 'SSE': 'Sudeste',
  'S': 'Sul', 'SSW': 'Sudoeste', 'SW': 'Sudoeste', 'WSW': 'Sudoeste',
  'W': 'Oeste', 'WNW': 'Noroeste', 'NW': 'Noroeste', 'NNW': 'Noroeste'
}

export const getWindDirectionCode = (d: string) => d.split(' ')[0]
export const formatWindDirection = (d: string) => ({ code: getWindDirectionCode(d), name: directionNames[getWindDirectionCode(d)] ?? getWindDirectionCode(d) })
export const directionToDegrees = (d: string): number => WIND_DEG[getWindDirectionCode(d)] ?? 0

export const WindCompass = ({ direction, speed }: { direction: string, speed: number }) => {
  const degrees = directionToDegrees(direction)
  const { code, name } = formatWindDirection(direction)
  const colorVar = speed <= 10 ? 'var(--color-rating-good)' : speed <= 20 ? 'var(--color-rating-fair)' : speed <= 30 ? 'var(--color-rating-poor)' : 'var(--color-rating-poor)'
  const color = colorVar
  const allDirs = [0,22.5,45,67.5,90,112.5,135,157.5,180,202.5,225,247.5,270,292.5,315,337.5]
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="120" height="120" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="62" fill="none" stroke={color} strokeWidth="0.8" strokeDasharray="2,4" opacity="0.18"/>
        <circle cx="70" cy="70" r="46" fill="none" stroke="currentColor" strokeWidth="0.6" className="text-muted-foreground" opacity="0.14"/>
        <circle cx="70" cy="70" r="28" fill="none" stroke="currentColor" strokeWidth="0.6" className="text-muted-foreground" opacity="0.10"/>
        <line x1="8" y1="70" x2="132" y2="70" stroke="currentColor" strokeWidth="0.3" className="text-muted-foreground" opacity="0.10"/>
        <line x1="70" y1="8" x2="70" y2="132" stroke="currentColor" strokeWidth="0.3" className="text-muted-foreground" opacity="0.10"/>
        {allDirs.map(deg => {
          const rad = (deg-90)*Math.PI/180
          const isCardinal = deg%90===0, isMain = deg%45===0
          const inner = isCardinal?50:isMain?52:55, outer = isCardinal?62:isMain?61:60
          return <line key={deg} x1={70+inner*Math.cos(rad)} y1={70+inner*Math.sin(rad)} x2={70+outer*Math.cos(rad)} y2={70+outer*Math.sin(rad)} stroke="currentColor" strokeWidth={isCardinal?1.5:isMain?1:0.7} className="text-muted-foreground" opacity={isCardinal?0.45:isMain?0.3:0.18}/>
        })}
        <text x="70" y="7" textAnchor="middle" fontSize="10" fontWeight="bold" fill={color}>N</text>
        <text x="70" y="136" textAnchor="middle" fontSize="9" fill="currentColor" className="text-muted-foreground" opacity="0.4">S</text>
        <text x="135" y="73" textAnchor="middle" fontSize="9" fill="currentColor" className="text-muted-foreground" opacity="0.4">L</text>
        <text x="5" y="73" textAnchor="middle" fontSize="9" fill="currentColor" className="text-muted-foreground" opacity="0.4">O</text>
        <g transform={`rotate(${degrees},70,70)`}>
          <line x1="70" y1="70" x2="70" y2="26" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
          <polygon points="70,15 64,28 76,28" fill={color}/>
          <line x1="70" y1="70" x2="70" y2="88" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.30"/>
        </g>
        <circle cx="70" cy="70" r="5.5" fill={color}/>
        <circle cx="70" cy="70" r="2.5" fill="white"/>
      </svg>
      <div className="text-center">
        <div className="text-base font-bold" style={{ color }}>{speed}km/h</div>
        <div className="text-xs text-muted-foreground">{code} — {name}</div>
      </div>
    </div>
  )
}
