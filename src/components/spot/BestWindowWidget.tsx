import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Crown, Waves, Wind, Zap } from 'lucide-react'
import { getRatingInfo } from '@/lib/rating'
import { supabase } from '@/lib/supabase'

interface HourlySlot {
  hour: number
  label: string
  score: number
  waveHeight: number
  windSpeed: number
  windDirection: string
  swellPeriod: number
  isPeak: boolean
}

interface HourlyResponse {
  slots: HourlySlot[]
  bestWindow: HourlySlot
}

interface Props {
  lat: number
  lng: number
  orientation: number
}

export function BestWindowWidget({ lat, lng, orientation }: Props) {
  const [data, setData] = useState<HourlyResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        const res = await fetch(
          `/api/hourly?lat=${lat}&lng=${lng}&orientation=${orientation}`,
          token ? { headers: { Authorization: `Bearer ${token}` } } : {}
        )
        if (!res.ok || cancelled) return
        const json = await res.json() as HourlyResponse
        if (!cancelled) setData(json)
      } catch { /* silencioso */ }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [lat, lng, orientation])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-5 flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <Clock className="h-4 w-4 animate-spin" />
          Calculando melhor janela...
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const { slots, bestWindow } = data
  const best = getRatingInfo(bestWindow.score)
  const nowHour = new Date().getHours()
  const isBestNow = bestWindow.hour <= nowHour && bestWindow.hour >= nowHour - 1

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Melhor Janela do Dia
          <Badge className="ml-auto bg-yellow-500/10 text-yellow-500 border-yellow-500/30 text-xs">
            <Crown className="h-3 w-3 mr-1" />Premium
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Destaque da melhor janela */}
        <div className={`rounded-2xl p-4 border ${best.bg}/20 border-border/40`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className={`h-4 w-4 ${best.color}`} />
                <span className={`text-sm font-bold ${best.color}`}>
                  {isBestNow ? 'Agora é o melhor momento!' : `Melhor às ${bestWindow.label}`}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Waves className="h-3 w-3" />{bestWindow.waveHeight.toFixed(1)}m
                </span>
                <span className="flex items-center gap-1">
                  <Wind className="h-3 w-3" />{bestWindow.windSpeed}km/h {bestWindow.windDirection}
                </span>
                <span>{bestWindow.swellPeriod}s período</span>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${best.color}`}>{bestWindow.score.toFixed(1)}</div>
              <div className={`text-xs font-bold ${best.color}`}>{best.label}</div>
            </div>
          </div>
        </div>

        {/* Gráfico de barras horário */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Score hora a hora de hoje:</p>
          <div className="flex items-end gap-0.5 h-14">
            {slots.map(slot => {
              const info = getRatingInfo(slot.score)
              const heightPct = Math.max(8, (slot.score / 10) * 100)
              const isPast = slot.hour < nowHour
              const isCurrent = slot.hour === nowHour
              return (
                <div key={slot.hour} className="flex-1 flex flex-col items-center gap-0.5" title={`${slot.label}: ${slot.score.toFixed(1)}`}>
                  <div
                    className={`w-full rounded-sm transition-all ${isPast ? 'opacity-30' : ''} ${slot.isPeak ? 'ring-1 ring-offset-1 ring-current' : ''}`}
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: isPast ? 'var(--muted-foreground)' : info.color,
                    }}
                  />
                  {(isCurrent || slot.hour % 4 === 0) && (
                    <span className={`text-[9px] ${isCurrent ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                      {isCurrent ? 'agr' : `${String(slot.hour).padStart(2, '0')}h`}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
