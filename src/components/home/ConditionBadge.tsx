import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { BeachCondition } from '@/lib/surfData'

// Classifica o ESTADO atual da condição (nota + vento agora) — não é uma tendência ao
// longo do tempo. Pra tendência de verdade (comparação com histórico), ver compareTrend.ts.
function getConditionLevel(spot: BeachCondition): 'good' | 'weak' | 'mid' {
  if (spot.score >= 7 && spot.windSpeed <= 12) return 'good'
  if (spot.score <= 5 && spot.windSpeed >= 20) return 'weak'
  return 'mid'
}

export function ConditionBadge({ spot, size = 'sm' }: { spot: BeachCondition; size?: 'sm' | 'lg' }) {
  const level = getConditionLevel(spot)
  const iconClass = size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'
  const textClass = size === 'lg' ? 'text-sm' : 'text-xs'

  if (level === 'good') return (
    <span className={`inline-flex items-center gap-1 ${textClass} text-rating-good font-semibold`}>
      <TrendingUp className={iconClass} />Boas condições
    </span>
  )
  if (level === 'weak') return (
    <span className={`inline-flex items-center gap-1 ${textClass} text-rating-fair font-semibold`}>
      <TrendingDown className={iconClass} />Condições fracas
    </span>
  )
  return (
    <span className={`inline-flex items-center gap-1 ${textClass} text-muted-foreground`}>
      <Minus className={iconClass} />Condições medianas
    </span>
  )
}
