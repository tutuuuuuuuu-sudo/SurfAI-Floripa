import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Crown, Waves, Wind, Zap } from 'lucide-react'
import { getRatingInfo } from '@/lib/rating'
import { supabase } from '@/lib/supabase'
import { nowHourSP } from '@/lib/timeSP'

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
  window: { startHour: number; endHour: number } | null
  windowExplanation: string | null
}

interface Props {
  lat: number
  lng: number
  orientation: number
}

export function BestWindowWidget({ lat, lng, orientation }: Props) {
  const [data, setData] = useState<HourlyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedHour, setSelectedHour] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setData(null)
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

  const { slots, bestWindow, window: goldenWindow, windowExplanation } = data
  const best = getRatingInfo(bestWindow.score)
  // Os slots vêm calculados no fuso de Floripa (api/hourly.ts) — usar o fuso do
  // dispositivo aqui divergiria para quem acessa de fora de America/Sao_Paulo.
  const nowHour = nowHourSP()
  const isBestNow = bestWindow.hour === nowHour
  const fmtHour = (h: number) => `${String(h).padStart(2, '0')}h`
  const isWindowRange = !!goldenWindow && goldenWindow.startHour !== goldenWindow.endHour
  const isInsideWindow = !!goldenWindow && nowHour >= goldenWindow.startHour && nowHour <= goldenWindow.endHour
  const headline = !isWindowRange
    ? (isBestNow ? 'Agora é o melhor momento!' : `Melhor às ${bestWindow.label}`)
    : isInsideWindow
      ? `Janela boa agora — vai até ${fmtHour(goldenWindow!.endHour)}`
      : `Melhor janela: ${fmtHour(goldenWindow!.startHour)} às ${fmtHour(goldenWindow!.endHour)}`

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Melhor Janela do Dia
          <Badge className="ml-auto bg-rating-fair/10 text-rating-fair border-rating-fair/30 text-xs">
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
                  {headline}
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
              {windowExplanation && (
                <p className="text-xs text-muted-foreground/80 mt-2">{windowExplanation}</p>
              )}
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${best.color}`}>{bestWindow.score.toFixed(1)}</div>
              <div className={`text-xs font-bold ${best.color}`}>{best.label}</div>
            </div>
          </div>
        </div>

        {/* Gráfico de barras horário */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Nota hora a hora de hoje — toque numa barra pra ver o detalhe:</p>
          <div className="flex items-end gap-0.5">
            {slots.map(slot => {
              const info = getRatingInfo(slot.score)
              const heightPct = Math.max(8, (slot.score / 10) * 100)
              const isPast = slot.hour < nowHour
              const isCurrent = slot.hour === nowHour
              const showLabel = isCurrent || slot.hour % 4 === 0
              const isSelected = selectedHour === slot.hour
              return (
                <button
                  key={slot.hour}
                  type="button"
                  onClick={() => setSelectedHour(isSelected ? null : slot.hour)}
                  className="flex-1 flex flex-col items-center gap-0.5 bg-transparent border-0 p-0 cursor-pointer"
                  title={`${slot.label} · ${info.label} (${slot.score.toFixed(1)}) · ${slot.waveHeight.toFixed(1)}m de onda · vento ${slot.windSpeed}km/h ${slot.windDirection} · período ${slot.swellPeriod}s`}
                >
                  {/* Altura em % só resolve com um pai de altura fixa em px — daí o wrapper abaixo */}
                  <div className="w-full flex items-end" style={{ height: '40px' }}>
                    <div
                      className={`w-full rounded-sm transition-all ${isPast ? 'opacity-30' : ''} ${slot.isPeak ? 'ring-1 ring-offset-1 ring-current' : ''} ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: isPast ? 'var(--muted-foreground)' : info.scoreColor,
                      }}
                    />
                  </div>
                  <span className={`text-[9px] h-3 leading-3 ${isCurrent ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                    {showLabel ? (isCurrent ? 'agr' : `${String(slot.hour).padStart(2, '0')}h`) : ''}
                  </span>
                </button>
              )
            })}
          </div>

          {selectedHour !== null && (() => {
            const sel = slots.find(s => s.hour === selectedHour)
            if (!sel) return null
            const selInfo = getRatingInfo(sel.score)
            return (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-2" style={{ animation: 'slideUp 0.15s ease-out' }}>
                <div>
                  <span className={`text-sm font-bold ${selInfo.color}`}>{fmtHour(sel.hour)} · {selInfo.label}</span>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {sel.waveHeight.toFixed(1)}m de onda · vento {sel.windSpeed}km/h {sel.windDirection} · período {sel.swellPeriod}s
                  </div>
                </div>
                <div className={`text-xl font-bold flex-shrink-0 ${selInfo.color}`}>{sel.score.toFixed(1)}</div>
              </div>
            )
          })()}
        </div>

      </CardContent>
    </Card>
  )
}
