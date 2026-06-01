import { useState } from 'react'
import { Waves, X } from 'lucide-react'
import type { BeachCondition } from '@/lib/surfData'

export function SwellAlert({ spots }: { spots: BeachCondition[] }) {
  const [dismissed, setDismissed] = useState(false)
  const bigSwellSpots = spots.filter(s => s.waveHeight >= 1.5)
  if (bigSwellSpots.length === 0 || dismissed) return null
  const best = bigSwellSpots.sort((a, b) => b.waveHeight - a.waveHeight)[0]
  return (
    <div className="relative bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 rounded-xl p-4 flex items-start gap-3 anim-slide" style={{ animationDelay: '0.1s' }}>
      <Waves className="h-6 w-6 text-primary flex-shrink-0" />
      <div className="flex-1">
        <div className="font-bold text-sm">Swell grande chegando!</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {best.name} com ondas de {best.waveHeight.toFixed(1)}m — período de {Math.round(best.swellPeriod)}s
        </div>
      </div>
      <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
