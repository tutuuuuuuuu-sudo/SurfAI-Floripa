import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { usePremium } from '@/lib/premium'
import { BeachCondition } from '@/lib/surfData'
import { useSurfData } from '@/contexts/SurfDataContext'
import { getWeatherForecast, WeatherForecast } from '@/lib/weatherData'
import { ArrowLeft, Waves, Wind, Calendar, Crown, TrendingUp, Thermometer } from 'lucide-react'
import { getScoreColor, getRatingInfo } from '@/lib/rating'

const getScoreLabel = (score: number) => getRatingInfo(score).label.charAt(0) + getRatingInfo(score).label.slice(1).toLowerCase()

export default function HistoryPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const { isPremium } = usePremium()
  const { conditions, loading } = useSurfData()
  const spots = useMemo(() => [...conditions].sort((a, b) => b.score - a.score), [conditions])
  const [selectedSpot, setSelectedSpot] = useState<string>(id ?? '')
  const [forecast, setForecast] = useState<WeatherForecast[]>([])
  const [loadingForecast, setLoadingForecast] = useState(false)

  // Seleciona a melhor praia por padrão quando os dados chegam
  useEffect(() => {
    if (!selectedSpot && spots.length > 0) setSelectedSpot(spots[0].id)
  }, [conditions]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedSpot) return
    const spot = spots.find(s => s.id === selectedSpot)
    if (!spot) return
    setLoadingForecast(true)
    let cancelled = false
    getWeatherForecast(spot.id, {
      waveHeight: spot.waveHeight,
      windSpeed: spot.windSpeed,
      swellPeriod: spot.swellPeriod,
      windDirection: spot.windDirection,
      waterTemperature: spot.waterConditions.temperature,
      score: spot.score,
    }, isPremium, spot.orientation).then(data => {
      if (!cancelled) { setForecast(data); setLoadingForecast(false) }
    })
    return () => { cancelled = true }
  }, [selectedSpot, spots, isPremium])

  const currentSpot = spots.find(s => s.id === selectedSpot)

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar
          </Button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Previsão 14 Dias
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-5">

        {/* Banner de upgrade para free */}
        {!isPremium && (
          <Card className="border-primary/20 bg-primary/5" style={{ animation: 'slideUp 0.4s ease-out' }}>
            <CardContent className="py-4 flex items-center gap-3">
              <Crown className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Previsão gratuita: 3 dias</p>
                <p className="text-xs text-muted-foreground">Premium libera 14 dias para qualquer praia</p>
              </div>
              <Button size="sm" onClick={() => navigate('/premium')}>
                Premium
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Seletor de praia */}
        {!loading && (
          <div style={{ animation: 'slideUp 0.3s ease-out' }}>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Escolha a praia:</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {spots.map(spot => {
                const color = getScoreColor(spot.score)
                const isSelected = spot.id === selectedSpot
                return (
                  <button
                    key={spot.id}
                    onClick={() => setSelectedSpot(spot.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      isSelected ? 'text-white border-transparent' : 'border-border text-muted-foreground hover:border-primary/30'
                    }`}
                    style={isSelected ? { backgroundColor: color } : {}}
                  >
                    {spot.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Info da praia selecionada */}
        {currentSpot && (
          <Card style={{ animation: 'slideUp 0.35s ease-out' }}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{currentSpot.name}</h2>
                  <p className="text-xs text-muted-foreground">{currentSpot.region} da Ilha</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold" style={{ color: getScoreColor(currentSpot.score) }}>
                    {currentSpot.score.toFixed(1)}
                  </div>
                  <div className="text-xs font-bold" style={{ color: getScoreColor(currentSpot.score) }}>
                    {getScoreLabel(currentSpot.score)}
                  </div>
                </div>
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div><div className="text-muted-foreground">Ondas</div><div className="font-bold">{currentSpot.waveHeight.toFixed(1)}m</div></div>
                <div><div className="text-muted-foreground">Período</div><div className="font-bold">{Math.round(currentSpot.swellPeriod)}s</div></div>
                <div><div className="text-muted-foreground">Vento</div><div className="font-bold">{Math.round(currentSpot.windSpeed)}km/h</div></div>
                <div><div className="text-muted-foreground">Água</div><div className="font-bold">{currentSpot.waterConditions.temperature}°C</div></div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Previsão: 3 dias (free) ou 14 dias (premium) */}
        <Card style={{ animation: 'slideUp 0.4s ease-out' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Previsão dos Próximos {isPremium ? '14' : '3'} Dias
              {isPremium && (
                <Badge className="ml-auto bg-yellow-500/10 text-yellow-500 border-yellow-500/30 text-xs">
                  <Crown className="h-3 w-3 mr-1" />Premium
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingForecast ? (
              <div className="flex justify-center py-8">
                <Waves className="h-6 w-6 text-primary animate-bounce" />
              </div>
            ) : (
              <div className="space-y-2">
                {(isPremium ? forecast : forecast.slice(0, 3)).map((day, idx) => {
                  const color = getScoreColor(day.score)
                  const label = getScoreLabel(day.score)
                  const isToday = idx === 0
                  return (
                    <div
                      key={day.date}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isToday ? 'bg-primary/5 border-primary/20' : 'border-border/40'}`}
                      style={{ animation: `slideUp 0.3s ${idx * 0.05}s ease-out both` }}
                    >
                      <div className="min-w-[70px]">
                        <div className="font-bold text-sm">{day.dayName}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </div>
                      </div>
                      <Separator orientation="vertical" className="h-10" />
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <Waves className="h-3.5 w-3.5 mx-auto mb-0.5 text-primary" />
                          <div className="text-xs font-semibold">{day.waveHeight.toFixed(1)}m</div>
                        </div>
                        <div className="text-center">
                          <Wind className="h-3.5 w-3.5 mx-auto mb-0.5 text-accent" />
                          <div className="text-xs font-semibold">{Math.round(day.windSpeed)}km/h</div>
                        </div>
                        <div className="text-center hidden sm:block">
                          <Thermometer className="h-3.5 w-3.5 mx-auto mb-0.5 text-chart-2" />
                          <div className="text-xs font-semibold">{day.temperature}°C</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold" style={{ color }}>{day.score.toFixed(1)}</div>
                        <div className="text-xs font-bold" style={{ color }}>{label}</div>
                        <div className="flex gap-0.5 mt-1 justify-end">
                          {[1,2,3,4,5].map(i => (
                            <div key={i} className="h-1 w-3 rounded-full" style={{ backgroundColor: i <= Math.ceil(day.score / 2) ? color : 'var(--muted)' }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full" onClick={() => currentSpot && navigate(`/spot/${currentSpot.id}`)}>
          Ver condições detalhadas de {currentSpot?.name ?? 'hoje'}
        </Button>
      </main>
    </div>
  )
}
