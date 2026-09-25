import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, ArrowUp, Waves, Wind, Droplets, Timer, Lock, MoveHorizontal, Sparkles } from 'lucide-react'
import { useSurfData } from '@/contexts/SurfDataContext'
import { supabase } from '@/lib/supabase'
import { getRatingInfo } from '@/lib/rating'
import { usePremium } from '@/lib/premium'
import { formatWaveRange, WIND_DEG } from '@/lib/surfData'
import { directionName } from '@/lib/directions'
import { getWeatherForecast, WeatherForecast, FREE_DAYS } from '@/lib/weatherData'
import { PremiumUpsellBanner } from '@/components/PremiumUpsellBanner'
import { WindCompass } from '@/components/spot/WindCompass'
import { DayTideChart } from '@/components/spot/DayTideChart'
import { DayCurve } from '@/components/spot/DayCurve'

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

const fmtHour = (h: number) => `${String(h).padStart(2, '0')}h`

function periodLabel(s: number) {
  if (s >= 12) return 'longo, onda com força'
  if (s >= 9) return 'médio'
  return 'curto, onda mais mexida'
}

export default function ForecastDayPage() {
  const navigate = useNavigate()
  const { id, dayIndex } = useParams<{ id: string; dayIndex: string }>()
  const { conditions } = useSurfData()
  const { isPremium, loading: premiumLoading } = usePremium()
  const spot = conditions.find(s => s.id === id)
  const dayIdx = Number(dayIndex ?? 0)

  const [data, setData] = useState<DayDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [selectedHour, setSelectedHour] = useState<number | null>(null)
  const [days, setDays] = useState<WeatherForecast[]>([])
  const activeChipRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!spot) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setLocked(false)
      setSelectedHour(null)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        const res = await fetch(
          `/api/forecast-day?lat=${spot!.lat}&lng=${spot!.lng}&orientation=${spot!._beachOrientation ?? 90}&dayIndex=${dayIndex}`,
          token ? { headers: { Authorization: `Bearer ${token}` } } : {}
        )
        if (cancelled) return
        if (res.status === 403) { setLocked(true); return }
        if (!res.ok) { setData(null); return }
        setData(await res.json() as DayDetail)
      } catch { /* silencioso, tela cai no estado vazio */ }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [spot, dayIndex])

  // Faixa de dias no topo — mesma lista (e cache) da aba Previsão de SpotDetails.tsx, pra
  // trocar de dia aqui mesmo sem voltar pra página da praia.
  useEffect(() => {
    if (!spot || premiumLoading) return
    let cancelled = false
    getWeatherForecast(
      spot.id,
      { waveHeight: spot.waveHeight, windSpeed: spot.windSpeed, swellPeriod: spot.swellPeriod, windDirection: spot.windDirection, waterTemperature: spot.waterConditions.temperature, score: spot.score },
      isPremium,
      spot._beachOrientation ?? 90
    ).then(d => { if (!cancelled) setDays(d) })
    return () => { cancelled = true }
  }, [spot, isPremium, premiumLoading])

  useEffect(() => {
    activeChipRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [dayIdx, days.length])

  const view = useMemo(() => {
    if (!data || data.hours.length === 0) return null
    const sunrise = data.sunriseHour ?? 6
    const sunset = data.sunsetHour ?? 18
    const isDay = (h: number) => h >= sunrise && h <= sunset
    const daylight = data.hours.filter(h => isDay(h.hour))
    const pool = daylight.length > 0 ? daylight : data.hours

    // Janela boa: horas de luz vizinhas da melhor hora que ficam a até 0.5 da nota dela
    const byHour = new Map(data.hours.map(h => [h.hour, h]))
    let from = data.best.hour, to = data.best.hour
    while (byHour.get(from - 1) && isDay(from - 1) && byHour.get(from - 1)!.score >= data.best.score - 0.5) from--
    while (byHour.get(to + 1) && isDay(to + 1) && byHour.get(to + 1)!.score >= data.best.score - 0.5) to++

    const waves = pool.map(h => h.waveHeight), winds = pool.map(h => h.windSpeed)
    return {
      window: { from, to },
      waveMin: Math.min(...waves), waveMax: Math.max(...waves),
      windMin: Math.min(...winds), windMax: Math.max(...winds),
    }
  }, [data])

  const sel = data ? (data.hours.find(h => h.hour === (selectedHour ?? data.best.hour)) ?? data.best) : null
  const selInfo = sel ? getRatingInfo(sel.score) : null
  const isBestSelected = !!(data && sel && sel.hour === data.best.hour)
  const tideNow = data?.tideHeights && sel ? data.tideHeights[sel.hour] : undefined
  const tideNext = data?.tideHeights && sel ? data.tideHeights[sel.hour + 1] : undefined
  const swellDeg = sel ? WIND_DEG[sel.swellDirection.toUpperCase()] : undefined

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between max-w-2xl">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar
          </Button>
          <h1 className="text-base font-bold truncate">{spot?.name ?? 'Praia'}</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 max-w-2xl space-y-4 pb-24">
        {!spot && (
          <p className="text-sm text-muted-foreground text-center py-8">Praia não encontrada.</p>
        )}

        {/* Faixa de dias */}
        {spot && days.length > 0 && (
          <div className="-mx-4 px-4 overflow-x-auto scrollbar-none">
            <div className="flex gap-2 w-max">
              {days.map((day, i) => {
                const active = i === dayIdx
                const dayLocked = i >= FREE_DAYS && !isPremium
                const r = getRatingInfo(day.score)
                return (
                  <button
                    key={day.date}
                    ref={active ? activeChipRef : undefined}
                    type="button"
                    onClick={() => dayLocked ? navigate('/premium') : navigate(`/forecast/${spot.id}/day/${i}`, { replace: true })}
                    aria-current={active ? 'date' : undefined}
                    className={`flex flex-col items-center gap-1 min-w-[58px] px-2.5 py-2 rounded-xl border text-xs transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      active ? 'border-primary/60 bg-primary/10' : 'border-border/40 bg-card hover:border-primary/30'
                    }`}
                  >
                    <span className={`font-bold ${active ? 'text-primary' : ''}`}>{i === 0 ? 'Hoje' : day.dayName}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                    {dayLocked
                      ? <Lock className="h-3 w-3 text-muted-foreground/60" />
                      : <span className={`h-1 w-6 rounded-full ${r.bg}`} />}
                  </button>
                )
              })}
            </div>
          </div>
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
          <div className="space-y-4">
            <Skeleton className="h-[330px] w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        )}

        {spot && !locked && !loading && (!data || !view) && (
          <p className="text-sm text-muted-foreground text-center py-8">Não deu pra carregar a previsão desse dia agora. Tente de novo em alguns minutos.</p>
        )}

        {spot && !locked && !loading && data && view && sel && selInfo && (
          <>
            {/* Linha do dia: nota da hora escolhida + curva arrastável */}
            <section
              className="relative overflow-hidden rounded-2xl border border-border/50 bg-card"
              style={{ animation: 'slideUp 0.35s ease-out both' }}
            >
              {/* Brilho ambiente na cor da nota da hora escolhida */}
              <div className={`pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full blur-3xl opacity-20 transition-colors duration-500 ${selInfo.bg}`} />

              <div className="relative p-4 pb-1">
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const d = new Date(data.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
                    return d.charAt(0).toUpperCase() + d.slice(1)
                  })()}
                </p>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-extrabold tabular-nums leading-none" style={{ color: selInfo.scoreColor }}>
                        {sel.score.toFixed(1)}
                      </span>
                      <span className="text-sm font-bold tracking-wide" style={{ color: selInfo.scoreColor }}>{selInfo.label}</span>
                    </div>
                    <p className="mt-1.5 text-sm">
                      às <span className="font-bold tabular-nums">{fmtHour(sel.hour)}</span>
                      {isBestSelected && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary align-middle">
                          <Sparkles className="h-3 w-3" />melhor hora do dia
                        </span>
                      )}
                    </p>
                  </div>
                  {!isBestSelected && (
                    <button
                      type="button"
                      onClick={() => setSelectedHour(data.best.hour)}
                      className="shrink-0 rounded-xl border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                    >
                      Ir pra melhor hora ({fmtHour(data.best.hour)})
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {view.window.to > view.window.from && (
                    <>Janela boa: <span className="font-semibold text-foreground">{fmtHour(view.window.from)} às {fmtHour(view.window.to)}</span> · </>
                  )}
                  <span className="tabular-nums">no dia, onda de {view.waveMin.toFixed(1)} a {view.waveMax.toFixed(1)}m e vento de {view.windMin} a {view.windMax}km/h</span>
                </p>
              </div>

              <div className="relative px-2">
                <DayCurve
                  hours={data.hours}
                  selectedHour={sel.hour}
                  bestHour={data.best.hour}
                  sunriseHour={data.sunriseHour}
                  sunsetHour={data.sunsetHour}
                  onSelect={setSelectedHour}
                />
              </div>

              <div className="relative flex items-center justify-center gap-1 border-t border-border/40 px-4 py-2 text-[11px] text-muted-foreground">
                <MoveHorizontal className="h-3.5 w-3.5" />Arraste pela curva pra ver cada hora
              </div>
            </section>

            {/* Condições da hora escolhida — tudo acompanha a curva */}
            <section className="grid grid-cols-2 gap-3" style={{ animation: 'slideUp 0.4s 0.05s ease-out both' }}>
              <div className="space-y-3">
                <div className="rounded-2xl border border-border/40 bg-card p-3.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Waves className="h-3.5 w-3.5 text-primary" />Onda</div>
                  <div key={`w${sel.hour}`} className="mt-1 text-xl font-bold tabular-nums" style={{ animation: 'fadeIn 0.25s ease-out' }}>
                    {formatWaveRange(sel.waveHeight)}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    {swellDeg !== undefined && (
                      <ArrowUp className="h-3.5 w-3.5 text-primary transition-transform duration-300" style={{ transform: `rotate(${swellDeg + 180}deg)` }} />
                    )}
                    <span>swell <span className="font-semibold text-foreground">{sel.swellDirection}</span> · {directionName(sel.swellDirection)}</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/40 bg-card p-3.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Timer className="h-3.5 w-3.5 text-primary" />Período</div>
                  <div key={`p${sel.hour}`} className="mt-1 text-xl font-bold tabular-nums" style={{ animation: 'fadeIn 0.25s ease-out' }}>{sel.swellPeriod}s</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{periodLabel(sel.swellPeriod)}</div>
                </div>
                {tideNow !== undefined && (
                  <div className="rounded-2xl border border-border/40 bg-card p-3.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Droplets className="h-3.5 w-3.5 text-primary" />Maré</div>
                    <div key={`t${sel.hour}`} className="mt-1 text-xl font-bold tabular-nums" style={{ animation: 'fadeIn 0.25s ease-out' }}>{tideNow.toFixed(1)}m</div>
                    {tideNext !== undefined && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {tideNext > tideNow + 0.02 ? 'enchendo' : tideNext < tideNow - 0.02 ? 'secando' : 'parada'}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-border/40 bg-card p-3.5 flex flex-col">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wind className="h-3.5 w-3.5 text-accent" />Vento às {fmtHour(sel.hour)}</div>
                <div className="flex-1 flex items-center justify-center py-2">
                  <WindCompass direction={sel.windDirection} speed={sel.windSpeed} orientation={spot._beachOrientation} />
                </div>
              </div>
            </section>

            {/* Maré do dia, com a hora escolhida marcada */}
            {data.tideHeights && (
              <Card style={{ animation: 'slideUp 0.45s 0.1s ease-out both' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-primary" />
                    Maré do dia
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DayTideChart heights={data.tideHeights} markerHour={sel.hour} />
                </CardContent>
              </Card>
            )}
          </>
        )}

        {spot && (
          <Button variant="outline" className="w-full" onClick={() => navigate(`/spot/${spot.id}`)}>
            Ver página completa de {spot.name}
          </Button>
        )}
      </main>
    </div>
  )
}
