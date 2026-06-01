import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { BeachCondition } from '@/lib/surfData'

function getTrend(spot: BeachCondition): 'up' | 'down' | 'stable' {
  if (spot.score >= 7 && spot.windSpeed <= 12) return 'up'
  if (spot.score <= 5 && spot.windSpeed >= 20) return 'down'
  return 'stable'
}

export function TrendBadge({ spot, size = 'sm' }: { spot: BeachCondition; size?: 'sm' | 'lg' }) {
  const trend = getTrend(spot)
  const iconClass = size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'
  const textClass = size === 'lg' ? 'text-sm' : 'text-xs'

  if (trend === 'up') return (
    <span className={`inline-flex items-center gap-1 ${textClass} text-green-500 font-semibold`}>
      <TrendingUp className={iconClass} />Melhorando
    </span>
  )
  if (trend === 'down') return (
    <span className={`inline-flex items-center gap-1 ${textClass} text-orange-400 font-semibold`}>
      <TrendingDown className={iconClass} />Piorando
    </span>
  )
  return (
    <span className={`inline-flex items-center gap-1 ${textClass} text-muted-foreground`}>
      <Minus className={iconClass} />Estável
    </span>
  )
}
