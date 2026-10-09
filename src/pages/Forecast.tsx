import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePremium } from '@/lib/premium'
import { useSurfData } from '@/contexts/SurfDataContext'
import { getWeatherForecast, FREE_DAYS, type WeatherForecast } from '@/lib/weatherData'
import { getFavorites } from '@/lib/favorites'
import { fetchIslandWindows, pickBestWindows, TREND_FROM_DAY, type BeachForecast } from '@/lib/forecastWindows'
import { useHomeRegion } from '@/lib/homeRegion'
import { useAuth } from '@/contexts/AuthContext'
import { ForecastDayCard } from '@/components/spot/ForecastDayCard'
import { BestWindows } from '@/components/forecast/BestWindows'
import { BeachPicker } from '@/components/forecast/BeachPicker'
import { PremiumUpsellBanner } from '@/components/PremiumUpsellBanner'
import { ArrowLeft, Calendar, Waves, CalendarRange } from 'lucide-react'

// Aba Previsão, redesenhada em 09/out/2026. Antes: fileira de praias rolando pro lado, um cartão
// repetindo o "agora" (já está na página da praia) e linhas com temperatura do ar, sem direção do
// vento nem período. Agora responde "quando e onde vale surfar": melhores janelas da ilha toda,
// praia escolhida numa lista por região e os dias com o mesmo cartão da página da praia — do 8º
// em diante, separados como tendência.

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// Dias trancados pro grátis, só pra mostrar o que falta (o servidor não manda o dado)
function lockedDays(from: WeatherForecast[], upTo: number): WeatherForecast[] {
  const last = from[from.length - 1]
  if (!last) return []
  return Array.from({ length: Math.max(0, upTo - from.length) }, (_, i) => {
    const d = new Date(`${last.date}T12:00:00`)
    d.setDate(d.getDate() + i + 1)
    return { ...last, date: d.toISOString().slice(0, 10), dayName: WEEKDAYS[d.getDay()], locked: true }
  })
}

export default function ForecastPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const { isPremium, loading: premiumLoading } = usePremium()
  const { conditions, loading } = useSurfData()
  const spots = useMemo(() => [...conditions].sort((a, b) => b.score - a.score), [conditions])
  const [chosenSpot, setChosenSpot] = useState<string | null>(id ?? null)
  const [forecastFor, setForecastFor] = useState<{ key: string; data: WeatherForecast[] } | null>(null)
  const [favorites, setFavorites] = useState<string[] | null>(null)
  const [windowsFor, setWindowsFor] = useState<{ premium: boolean; beaches: BeachForecast[]; days: number } | null>(null)
  const { user } = useAuth()
  const usesFeet = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('pref_units') ?? '"metric"') === 'imperial' } catch { return false }
  }, [])

  useEffect(() => { getFavorites().catch(() => [] as string[]).then(setFavorites) }, [])
  const favoriteIds = favorites ?? []

  // Praia padrão: a favorita com a maior nota agora; sem favorita, a melhor da ilha agora
  const defaultSpot = favorites === null ? '' : (spots.find(s => favorites.includes(s.id)) ?? spots[0])?.id ?? ''
  const selectedSpot = chosenSpot ?? defaultSpot

  useEffect(() => {
    if (premiumLoading) return
    let cancelled = false
    fetchIslandWindows(isPremium).then(data => {
      if (!cancelled) setWindowsFor({ premium: isPremium, beaches: data?.beaches ?? [], days: data?.days ?? FREE_DAYS })
    })
    return () => { cancelled = true }
  }, [isPremium, premiumLoading])
  const loadingWindows = premiumLoading || windowsFor?.premium !== isPremium

  // Melhores janelas da região que a pessoa mais frequenta, com a ilha toda a um toque
  // (09/out/2026, ideia do usuário — ver src/lib/homeRegion.ts)
  const homeRegion = useHomeRegion(user?.id, favorites)
  const [scope, setScope] = useState<'region' | 'island'>(() => {
    try { return localStorage.getItem('windows_scope') === 'island' ? 'island' : 'region' } catch { return 'region' }
  })
  const changeScope = (next: 'region' | 'island') => {
    setScope(next)
    try { localStorage.setItem('windows_scope', next) } catch { /* só não lembra */ }
  }
  const allBeaches = windowsFor?.beaches ?? []
  const islandWindows = pickBestWindows(allBeaches)
  const regionWindows = homeRegion ? pickBestWindows(allBeaches.filter(b => b.region === homeRegion.region)) : []
  const showRegion = !!homeRegion && scope === 'region'
  // Na região, avisa se a ilha tem uma janela pelo menos 1 ponto melhor fora dela
  const regionBest = Math.max(0, ...regionWindows.map(w => w.day.score))
  const islandAlert = showRegion
    ? [...islandWindows].sort((a, b) => b.day.score - a.day.score)
        .find(w => allBeaches.find(b => b.id === w.beachId)?.region !== homeRegion.region && w.day.score >= regionBest + 1) ?? null
    : null

  const forecastKey = `${selectedSpot}|${isPremium}`
  useEffect(() => {
    const spot = spots.find(s => s.id === selectedSpot)
    if (!spot) return
    let cancelled = false
    getWeatherForecast(spot.id, {
      waveHeight: spot.waveHeight,
      windSpeed: spot.windSpeed,
      swellPeriod: spot.swellPeriod,
      windDirection: spot.windDirection,
      waterTemperature: spot.waterConditions.temperature,
      score: spot.score,
    }, isPremium, spot._beachOrientation ?? 90).then(data => {
      if (!cancelled) setForecastFor({ key: `${spot.id}|${isPremium}`, data })
    })
    return () => { cancelled = true }
  }, [selectedSpot, spots, isPremium])
  const loadingForecast = forecastFor?.key !== forecastKey
  const forecast = loadingForecast ? [] : forecastFor.data

  const currentSpot = spots.find(s => s.id === selectedSpot)
  const selectSpot = (spotId: string) => {
    setChosenSpot(spotId)
    navigate(`/forecast/${spotId}`, { replace: true })
  }

  const visible = isPremium ? forecast : forecast.slice(0, FREE_DAYS)
  const week = isPremium ? visible.slice(0, TREND_FROM_DAY) : [...visible, ...lockedDays(visible, TREND_FROM_DAY)]
  const trend = isPremium ? visible.slice(TREND_FROM_DAY) : []
  const card = (day: WeatherForecast, index: number) => (
    <ForecastDayCard
      key={day.date}
      day={day}
      index={index}
      isPremium={isPremium}
      usesFeet={usesFeet}
      freeDays={FREE_DAYS}
      onUpgrade={() => navigate('/premium')}
      onOpen={() => currentSpot && navigate(`/forecast/${currentSpot.id}/day/${index}`)}
      trend={index >= TREND_FROM_DAY}
    />
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-3 max-w-2xl flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />Voltar
          </Button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Previsão
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 pb-28 max-w-2xl space-y-5">
        {!isPremium && !premiumLoading && (
          <PremiumUpsellBanner title="Previsão gratuita: 3 dias" subtitle="Premium libera 14 dias para qualquer praia" />
        )}

        <BestWindows
          windows={showRegion ? regionWindows : islandWindows}
          loading={loadingWindows || homeRegion === undefined}
          isPremium={isPremium}
          days={windowsFor?.days ?? FREE_DAYS}
          region={homeRegion ? { ...homeRegion, active: scope, onChange: changeScope } : null}
          islandAlert={islandAlert}
        />

        {loading ? (
          <Skeleton className="h-[76px] w-full rounded-2xl" />
        ) : (
          <BeachPicker spots={spots} selectedId={selectedSpot} favorites={favoriteIds} onSelect={selectSpot} />
        )}

        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Waves className="h-4 w-4 text-primary" />
            <h2 className="font-bold text-sm">Próximos 7 dias</h2>
            {currentSpot && <span className="text-xs text-muted-foreground">· {currentSpot.name}</span>}
          </div>
          {loadingForecast || loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[178px] rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">{week.map((day, i) => card(day, i))}</div>
          )}
        </section>

        {trend.length > 0 && !loadingForecast && (
          <section className="space-y-2.5">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-bold text-sm">Tendência · 8 a 14 dias</h2>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">Previsão longa muda bastante. Confira de novo mais perto do dia.</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">{trend.map((day, i) => card(day, i + TREND_FROM_DAY))}</div>
          </section>
        )}

        {currentSpot && (
          <Button variant="outline" className="w-full" onClick={() => navigate(`/spot/${currentSpot.id}`)}>
            Ver condições de agora em {currentSpot.name}
          </Button>
        )}
      </main>
    </div>
  )
}
