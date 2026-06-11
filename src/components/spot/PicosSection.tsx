import { useState } from 'react'
import { MapPin, Star, Navigation, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BeachCondition } from '@/lib/surfData'

const swellDirOrder = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']

export const PicosSection = ({ spot }: { spot: BeachCondition }) => {
  const [selectedId, setSelectedId] = useState<string|null>(null)

  if (!spot.subRegions || spot.subRegions.length === 0) return null

  const currentSwellIdx = swellDirOrder.indexOf(spot.swellDirection)

  const enrichedPicos = spot.subRegions.map(sub => {
    const idealDirs: string[] = sub.swellDirections ?? []
    let minDiff = 8
    idealDirs.forEach(dir => {
      const idx = swellDirOrder.indexOf(dir)
      if (idx >= 0 && currentSwellIdx >= 0) {
        let diff = Math.abs(currentSwellIdx - idx)
        if (diff > 8) diff = 16 - diff
        if (diff < minDiff) minDiff = diff
      }
    })
    const mult = minDiff===0?1.05:minDiff===1?1.00:minDiff===2?0.95:minDiff<=4?0.88:0.80
    const waveEst = spot.waveHeight * mult
    const waveMin = (waveEst * 0.95).toFixed(1)
    const waveMax = (waveEst * 1.05).toFixed(1)
    const match = minDiff===0?'Swell perfeito':minDiff<=2?'Swell bom':minDiff<=4?'Swell parcial':'Swell ruim'
    const matchColor = minDiff===0?'#22c55e':minDiff<=2?'#06b6d4':minDiff<=4?'#f59e0b':'#ef4444'
    return { ...sub, waveMin, waveMax, match, matchColor, idealDirs, minDiff }
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary"/>
        <span className="font-semibold text-sm">Picos da Praia</span>
        <span className="text-xs text-muted-foreground">— qual está melhor agora?</span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {enrichedPicos.map((pico, idx) => {
          const isSelected = selectedId === pico.id
          return (
            <div
              key={pico.id}
              className={`rounded-xl border transition-all cursor-pointer overflow-hidden ${
                pico.bestNow ? 'border-primary/30 bg-primary/5' : 'border-border/40 bg-card hover:bg-muted/20'
              }`}
              style={{animation:`slideInLeft 0.35s ${idx*0.07}s ease-out both`}}
              onClick={() => setSelectedId(isSelected ? null : pico.id)}
            >
              <div className="flex items-center gap-3 p-3">
                <div className="flex-shrink-0">
                  {pico.bestNow
                    ? <Star className="h-4 w-4 text-primary fill-primary"/>
                    : <div className="h-2 w-2 rounded-full bg-muted-foreground/40 mt-1"/>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{pico.name}</span>
                    {pico.bestNow && <Badge className="text-xs bg-primary text-primary-foreground px-2 py-0">Melhor agora</Badge>}
                  </div>
                  {pico.description && <p className="text-xs text-muted-foreground mt-0.5">{pico.description}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold">{pico.waveMin}–{pico.waveMax}m</div>
                  <div className="text-xs font-semibold" style={{color: pico.matchColor}}>{pico.match}</div>
                </div>
                <ChevronRight className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${isSelected ? 'rotate-90' : ''}`}/>
              </div>

              {isSelected && (
                <div className="px-3 pb-3 pt-1 border-t border-border/30" style={{animation:'slideUp 0.2s ease-out'}}>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="bg-background/60 rounded-xl p-2">
                      <div className="text-xs text-muted-foreground">Ondas</div>
                      <div className="text-sm font-bold text-primary">{pico.waveMin}–{pico.waveMax}m</div>
                    </div>
                    <div className="bg-background/60 rounded-xl p-2">
                      <div className="text-xs text-muted-foreground">Período</div>
                      <div className="text-sm font-bold">{Math.round(spot.swellPeriod)}s</div>
                    </div>
                    <div className="bg-background/60 rounded-xl p-2">
                      <div className="text-xs text-muted-foreground">Vento</div>
                      <div className="text-sm font-bold">{Math.round(spot.windSpeed)}km/h</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground bg-background/40 rounded-lg p-2 mb-2">
                    {pico.minDiff===0
                      ? `Swell de ${spot.swellDirection} é ideal para este pico.`
                      : pico.minDiff<=2
                      ? `Swell de ${spot.swellDirection} funciona bem. Ideal: ${pico.idealDirs.join(' ou ')}.`
                      : `Melhor com swell de ${pico.idealDirs.join(', ')}.`}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${pico.lat},${pico.lng}&travelmode=driving`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary/90 transition-colors"
                      onClick={e => e.stopPropagation()}
                    >
                      <Navigation className="h-3.5 w-3.5"/>Google Maps
                    </a>
                    <a
                      href={`https://waze.com/ul?ll=${pico.lat},${pico.lng}&navigate=yes`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border border-border hover:bg-muted/50 transition-colors"
                      onClick={e => e.stopPropagation()}
                    >
                      <Navigation className="h-3.5 w-3.5"/>Waze
                    </a>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
