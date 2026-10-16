import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Crown, MoveHorizontal, Waves, Wind, Zap } from 'lucide-react'
import { getRatingInfo } from '@/lib/rating'
import { supabase } from '@/lib/supabase'
import { nowHourSP } from '@/lib/timeSP'
import { DayCurve } from '@/components/spot/DayCurve'

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
  sunriseHour: number | null
  sunsetHour: number | null
}

interface Props {
  lat: number
  lng: number
  orientation: number
  // Leitura "agora" já carregada pela própria SpotDetails (mesma nota do badge do topo da
  // página) — usada pra sobrescrever o slot da hora atual aqui embaixo. Sem isso, esse
  // widget fazia sua PRÓPRIA busca de dado "ao vivo" no servidor, numa chamada separada e
  // em outro instante — com um swell mudando rápido (achado 24/ago/2026, ex: Matadeiro
  // mostrando 8.7 no topo e 7.5 aqui pro mesmo "agora"), os dois podiam divergir de
  // verdade mesmo com o mesmo código, só por causa da diferença de alguns segundos/minutos
  // entre as duas chamadas. Usar o mesmo dado já carregado elimina essa janela de tempo.
  current: { waveHeight: number; windSpeed: number; windDirection: string; swellPeriod: number; score: number }
}

export function BestWindowWidget({ lat, lng, orientation, current }: Props) {
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

  // Os slots vêm calculados no fuso de Floripa (api/hourly.ts) — usar o fuso do
  // dispositivo aqui divergiria para quem acessa de fora de America/Sao_Paulo.
  const nowHour = nowHourSP()

  // Sobrescreve o slot da hora atual com `current` (mesma leitura do badge do topo da
  // página) — garante que "agora" aqui NUNCA diverge do resto da tela, nem quando as
  // condições estão mudando rápido (ver comentário na prop `current` acima).
  const slots = data.slots.map(s => s.hour === nowHour ? { ...s, ...current } : s)
  const bestWindow = data.bestWindow.hour === nowHour ? { ...data.bestWindow, ...current } : data.bestWindow
  const { window: goldenWindow, windowExplanation, sunriseHour, sunsetHour } = data
  const best = getRatingInfo(bestWindow.score)
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

        {/* Curva do dia (mesma DayCurve da página de previsão de um dia, ForecastDay.tsx —
            trocou as barras em 25/set/2026 a pedido do usuário). Abre na hora atual;
            arrastar mostra o detalhe de qualquer hora logo abaixo. */}
        {(() => {
          const selHour = selectedHour ?? (slots.some(s => s.hour === nowHour) ? nowHour : bestWindow.hour)
          const sel = slots.find(s => s.hour === selHour) ?? slots[0]
          if (!sel) return null
          const selInfo = getRatingInfo(sel.score)
          const isNow = sel.hour === nowHour
          return (
            <div>
              <div className="-mx-2">
                <DayCurve
                  hours={slots}
                  selectedHour={sel.hour}
                  bestHour={bestWindow.hour}
                  sunriseHour={sunriseHour}
                  sunsetHour={sunsetHour}
                  nowHour={nowHour}
                  goodWindow={goldenWindow ? { from: goldenWindow.startHour, to: goldenWindow.endHour } : null}
                  onSelect={setSelectedHour}
                />
              </div>
              <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                <MoveHorizontal className="h-3.5 w-3.5" />Arraste pela curva pra ver cada hora
              </p>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5">
                <div className="min-w-0">
                  <span className={`text-sm font-bold ${selInfo.color}`}>
                    {isNow ? 'Agora' : fmtHour(sel.hour)} · {selInfo.label}
                  </span>
                  <div key={sel.hour} className="text-xs text-muted-foreground mt-0.5" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                    {sel.waveHeight.toFixed(1)}m de onda · vento {sel.windSpeed}km/h {sel.windDirection} · período {sel.swellPeriod}s
                  </div>
                </div>
                <div className={`text-xl font-bold tabular-nums flex-shrink-0 ${selInfo.color}`}>{sel.score.toFixed(1)}</div>
              </div>
            </div>
          )
        })()}

      </CardContent>
    </Card>
  )
}
