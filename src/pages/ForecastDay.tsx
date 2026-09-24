import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Waves, Wind, Calendar, Droplets } from 'lucide-react'
import { useSurfData } from '@/contexts/SurfDataContext'
import { supabase } from '@/lib/supabase'
import { getRatingInfo } from '@/lib/rating'
import { PremiumUpsellBanner } from '@/components/PremiumUpsellBanner'
import { WindCompass } from '@/components/spot/WindCompass'
import { DayTideChart } from '@/components/spot/DayTideChart'

interface DayHour {
  hour: number
  waveHeight: number
  windSpeed: number
  windDirection: string
  swellPeriod: number
  swellDirection: string
  temperature: number
  score: number
}

interface DayDetail {
  date: string
  dayName: string
  dayIndex: number
  hours: DayHour[]
  best: DayHour
  sunriseHour: number | null
  sunsetHour: number | null
  tideHeights: number[] | null
}

export default function ForecastDayPage() {
  const navigate = useNavigate()
  const { id, dayIndex } = useParams<{ id: string; dayIndex: string }>()
  const { conditions } = useSurfData()
  const spot = conditions.find(s => s.id === id)

  const [data, setData] = useState<DayDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [selectedHour, setSelectedHour] = useState<number | null>(null)

  useEffect(() => {
    if (!spot) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setLocked(false)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        const res = await fetch(
          `/api/forecast-day?lat=${spot!.lat}&lng=${spot!.lng}&orientation=${spot!._beachOrientation ?? 90}&dayIndex=${dayIndex}`,
          token ? { headers: { Authorization: `Bearer ${token}` } } : {}
        )
        if (cancelled) return
        if (res.status === 403) { setLocked(true); return }
        if (!res.ok) return
        setData(await res.json() as DayDetail)
      } catch { /* silencioso, tela cai no estado vazio */ }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [spot, dayIndex])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar
          </Button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {spot?.name ?? 'Praia'}
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-5">
        {!spot && (
          <p className="text-sm text-muted-foreground text-center py-8">Praia não encontrada.</p>
        )}

        {spot && locked && (
          <div style={{ animation: 'slideUp 0.3s ease-out' }}>
            <PremiumUpsellBanner
              title="Esse dia é Premium"
              subtitle="A previsão gratuita cobre só os 3 primeiros dias — Premium libera o detalhe hora a hora de todos os 14"
            />
          </div>
        )}

        {spot && !locked && loading && (
          <div className="space-y-5">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        )}

        {spot && !locked && !loading && !data && (
          <p className="text-sm text-muted-foreground text-center py-8">Não deu pra carregar a previsão desse dia agora.</p>
        )}

        {spot && !locked && !loading && data && (() => {
          const best = getRatingInfo(data.best.score)
          const fmtHour = (h: number) => `${String(h).padStart(2, '0')}h`
          return (
            <>
              <Card style={{ animation: 'slideUp 0.3s ease-out' }}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold">{data.dayName}</h2>
                      <p className="text-xs text-muted-foreground">
                        {new Date(data.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', weekday: 'long' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold" style={{ color: best.scoreColor }}>{data.best.score.toFixed(1)}</div>
                      <div className="text-xs font-bold" style={{ color: best.scoreColor }}>{best.label}</div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Melhor momento do dia: {fmtHour(data.best.hour)}, {data.best.waveHeight.toFixed(1)}m de onda, vento {data.best.windSpeed}km/h {data.best.windDirection}, período {data.best.swellPeriod}s.
                  </p>
                </CardContent>
              </Card>

              <Card style={{ animation: 'slideUp 0.35s ease-out' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Waves className="h-4 w-4 text-primary" />
                    Hora a hora de {data.dayName.toLowerCase() === 'hoje' ? 'hoje' : data.dayName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-2">
                    Toque numa barra pra ver o detalhe. Horário noturno (depois das {String(data.sunsetHour ?? 18).padStart(2, '0')}h, antes das {String(data.sunriseHour ?? 6).padStart(2, '0')}h) em cinza, ninguém surfa de noite.
                  </p>
                  <div className="flex items-end gap-0.5">
                    {data.hours.map(hour => {
                      const info = getRatingInfo(hour.score)
                      const heightPct = Math.max(8, (hour.score / 10) * 100)
                      // Usa pôr/nascer do sol reais (fallback 18h/6h) — antes era limiar fixo
                      // em 18h e cortava a última hora de luz real do dia (achado 24/set/2026).
                      const isNight = hour.hour > (data.sunsetHour ?? 18) || hour.hour < (data.sunriseHour ?? 6)
                      const showLabel = hour.hour % 4 === 0
                      const isSelected = selectedHour === hour.hour
                      const isBest = hour.hour === data.best.hour
                      return (
                        <button
                          key={hour.hour}
                          type="button"
                          onClick={() => setSelectedHour(isSelected ? null : hour.hour)}
                          className="flex-1 flex flex-col items-center gap-0.5 bg-transparent border-0 p-0 cursor-pointer"
                          title={`${fmtHour(hour.hour)} · ${isNight ? 'Fora do horário de surf' : info.label} (${hour.score.toFixed(1)}) · ${hour.waveHeight.toFixed(1)}m de onda · vento ${hour.windSpeed}km/h ${hour.windDirection} · período ${hour.swellPeriod}s`}
                        >
                          <div className="w-full flex items-end" style={{ height: '40px' }}>
                            <div
                              className={`w-full rounded-sm transition-all ${isBest && !isNight ? 'ring-1 ring-offset-1 ring-current' : ''} ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                              style={{
                                height: `${heightPct}%`,
                                backgroundColor: isNight ? 'var(--muted-foreground)' : info.scoreColor,
                                opacity: isNight ? 0.4 : undefined,
                              }}
                            />
                          </div>
                          <span className="text-[9px] h-3 leading-3 text-muted-foreground">
                            {showLabel ? `${String(hour.hour).padStart(2, '0')}h` : ''}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {selectedHour !== null && (() => {
                    const sel = data.hours.find(h => h.hour === selectedHour)
                    if (!sel) return null
                    const selInfo = getRatingInfo(sel.score)
                    return (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-2" style={{ animation: 'slideUp 0.15s ease-out' }}>
                        <div>
                          <span className="text-sm font-bold" style={{ color: selInfo.scoreColor }}>{fmtHour(sel.hour)} · {selInfo.label}</span>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {sel.waveHeight.toFixed(1)}m de onda ({sel.swellDirection}) · vento {sel.windSpeed}km/h {sel.windDirection} · período {sel.swellPeriod}s
                          </div>
                        </div>
                        <div className="text-xl font-bold flex-shrink-0" style={{ color: selInfo.scoreColor }}>{sel.score.toFixed(1)}</div>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl border border-border/40 p-3">
                  <Waves className="h-3.5 w-3.5 mx-auto mb-1 text-primary" />
                  <div className="text-muted-foreground">Onda</div>
                  <div className="font-bold">{data.best.waveHeight.toFixed(1)}m</div>
                </div>
                <div className="rounded-xl border border-border/40 p-3">
                  <Wind className="h-3.5 w-3.5 mx-auto mb-1 text-accent" />
                  <div className="text-muted-foreground">Vento</div>
                  <div className="font-bold">{data.best.windSpeed}km/h</div>
                </div>
                <div className="rounded-xl border border-border/40 p-3">
                  <Calendar className="h-3.5 w-3.5 mx-auto mb-1 text-chart-2" />
                  <div className="text-muted-foreground">Período</div>
                  <div className="font-bold">{data.best.swellPeriod}s</div>
                </div>
              </div>

              {/* Vento (bússola) e ondulação do melhor momento do dia — mesmo padrão visual
                  de SpotDetails.tsx, pedido do usuário 24/set/2026 pra dar o mesmo nível de
                  detalhe que a aba "Agora" já tem, só que pra qualquer um dos 14 dias. */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-1.5 text-primary">
                      <Waves className="h-4 w-4" />
                      <span className="text-sm font-semibold">Ondulação</span>
                    </div>
                    <div className="text-2xl font-bold">{data.best.waveHeight.toFixed(1)}m</div>
                    <div>
                      <div className="text-xs text-muted-foreground">Período</div>
                      <div className="text-sm font-bold">{data.best.swellPeriod}s</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Direção do Swell</div>
                      <div className="text-sm font-bold">{data.best.swellDirection}</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden">
                  <CardContent className="p-4 flex flex-col items-center justify-center gap-2">
                    <div className="flex items-center gap-1.5 text-accent self-start">
                      <Wind className="h-4 w-4" />
                      <span className="text-sm font-semibold">Vento</span>
                    </div>
                    <WindCompass direction={data.best.windDirection} speed={data.best.windSpeed} />
                  </CardContent>
                </Card>
              </div>

              {/* Maré do dia — só renderiza se a fonte tiver dado suficiente pra esse dia
                  específico (ver comentário em api/forecast-day.ts sobre o alcance real). */}
              {data.tideHeights && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Droplets className="h-4 w-4 text-primary" />
                      Maré de {data.dayName.toLowerCase() === 'hoje' ? 'hoje' : data.dayName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DayTideChart heights={data.tideHeights} />
                  </CardContent>
                </Card>
              )}
            </>
          )
        })()}

        {spot && (
          <Button variant="outline" className="w-full" onClick={() => navigate(`/spot/${spot.id}`)}>
            Ver página completa de {spot.name}
          </Button>
        )}
      </main>
    </div>
  )
}
