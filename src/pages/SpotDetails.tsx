import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { analyzeConditions, BeachCondition } from '@/lib/surfData'
import { useSurfData } from '@/contexts/SurfDataContext'
import { getWeatherForecast, WeatherForecast, FREE_DAYS } from '@/lib/weatherData'
import { isFavorite, toggleFavorite } from '@/lib/favorites'
import { usePremium } from '@/lib/premium'
import {
  ArrowLeft, Waves, Wind, Navigation,
  TrendingUp, Compass, AlertCircle, Thermometer,
  Heart, Calendar, Sun, ChevronDown,
  Share2, MessageCircle, Lock, Crown, Clock, Droplets
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from 'sonner'
import { getRatingInfo } from '@/lib/rating'
import { WindCompass, formatWindDirection } from '@/components/spot/WindCompass'
import { TideChart } from '@/components/spot/TideChart'
import { CommentsSection } from '@/components/spot/CommentsSection'
import { ScoreExplainer } from '@/components/spot/ScoreExplainer'
import { PicosSection } from '@/components/spot/PicosSection'

const FIXED_DOMAIN = typeof window !== 'undefined' ? window.location.origin : ''
const metersToFeet = (m: number): string => `${(m * 3.281).toFixed(1)}ft`

const AnimatedProgress = ({ value }: { value: number }) => {
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => { const t = setTimeout(() => setDisplayed(value), 100); return () => clearTimeout(t) }, [value])
  return <Progress value={displayed} className="h-1.5 transition-all duration-1000 ease-out"/>
}

const SwellPeriodBadge = ({ period }: { period: number }) => {
  const [open, setOpen] = useState(false)
  const getInfo = (p: number) => {
    if (p >= 14) return { label: 'Épico', color: '#8b5cf6', desc: 'Swell de longo período — ondas perfeitas e muito potentes.' }
    if (p >= 12) return { label: 'Muito Bom', color: '#06b6d4', desc: 'Excelente ondulação — ondas longas, limpas e com energia.' }
    if (p >= 10) return { label: 'Bom', color: '#22c55e', desc: 'Boa ondulação — ondas bem formadas e surfáveis.' }
    if (p >= 8)  return { label: 'Regular', color: '#f59e0b', desc: 'Ondulação moderada — surfável mas sem muita qualidade.' }
    return { label: 'Fraco', color: '#ef4444', desc: 'Vento local — ondas curtas e bagunçadas.' }
  }
  const info = getInfo(period)
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5">
        <div className="text-lg font-semibold">{Math.round(period)}s</div>
        <span className="text-xs px-1.5 py-0.5 rounded-full font-bold text-white" style={{backgroundColor: info.color}}>{info.label}</span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}/>
      </button>
      {open && <div className="mt-2 text-xs text-muted-foreground bg-muted/20 rounded-lg p-2 border" style={{borderColor: info.color + '40'}}>{info.desc}</div>}
    </div>
  )
}

const ShareButton = ({ spot }: { spot: BeachCondition }) => {
  const handleShare = async () => {
    const rating = getRatingInfo(spot.score)
    const spotUrl = `${FIXED_DOMAIN}/spot/${spot.id}`
    const text = `🏄 ${spot.name} está ${rating.label} agora!\n\nScore: ${spot.score.toFixed(1)}/10\nOndas: ${spot.waveHeight.toFixed(1)}m · Período: ${Math.round(spot.swellPeriod)}s\nVento: ${Math.round(spot.windSpeed)}km/h · Água: ${spot.waterConditions.temperature}°C\n\nVeja mais: ${spotUrl}`
    if (navigator.share) { try { await navigator.share({ title: `Surf AI — ${spot.name}`, text, url: spotUrl }); return } catch (_) {} }
    await navigator.clipboard.writeText(text)
    toast.success('Condições copiadas! Cole no WhatsApp 📋')
  }
  return (
    <button onClick={handleShare} className="p-2 rounded-xl border border-border hover:bg-muted/50 transition-colors">
      <Share2 className="h-4 w-4"/>
    </button>
  )
}

const ForecastCard = ({
  day, index, isPremium, usesFeet, freeDays, onUpgrade
}: {
  day: WeatherForecast
  index: number
  isPremium: boolean
  usesFeet: boolean
  freeDays: number
  onUpgrade: () => void
}) => {
  const isLocked = index >= freeDays && !isPremium
  const isToday = index === 0
  const rating = getRatingInfo(day.score)

  if (isLocked) {
    return (
      <button
        onClick={onUpgrade}
        className="flex flex-col items-center justify-center gap-1 p-3 rounded-2xl border border-dashed border-border/40 bg-muted/10 hover:bg-muted/20 transition-all min-h-[120px]"
        style={{animation:`fadeIn 0.4s ${index*0.05}s ease-out both`}}
      >
        <Lock className="h-4 w-4 text-muted-foreground/50 mb-1"/>
        <div className="text-xs font-bold text-muted-foreground">{day.dayName}</div>
        <Crown className="h-3.5 w-3.5 text-rating-fair"/>
      </button>
    )
  }

  return (
    <div
      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
        isToday ? 'bg-primary/8 border-primary/30 shadow-sm' : 'bg-card border-border/40 hover:border-primary/20'
      }`}
      style={{animation:`fadeIn 0.4s ${index*0.05}s ease-out both`}}
    >
      <div className="text-center">
        <div className={`text-xs font-bold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
          {isToday ? 'Hoje' : day.dayName}
        </div>
        <div className="text-xs text-muted-foreground/60">
          {new Date(day.date+'T12:00:00').toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit'})}
        </div>
      </div>
      <div className={`text-2xl font-bold ${rating.color}`}>{Number(day.score).toFixed(1)}</div>
      <div className={`text-xs font-semibold ${rating.color}`}>{rating.label}</div>
      <div className="flex gap-0.5">{[1,2,3,4,5].map(i=><div key={i} className={`h-1 w-3.5 rounded-full ${i<=rating.bars?rating.bg:'bg-muted'}`}/>)}</div>
      <Separator className="w-full opacity-30"/>
      <div className="w-full space-y-1">
        <div className="flex items-center justify-between">
          <Waves className="h-3 w-3 text-muted-foreground"/>
          <span className="text-xs font-semibold">{usesFeet ? metersToFeet(day.waveHeight) : `${Number(day.waveHeight).toFixed(1)}m`}</span>
        </div>
        <div className="flex items-center justify-between">
          <Wind className="h-3 w-3 text-muted-foreground"/>
          <span className="text-xs font-semibold">{Math.round(day.windSpeed)}km/h</span>
        </div>
        <div className="flex items-center justify-between">
          <Thermometer className="h-3 w-3 text-muted-foreground"/>
          <span className="text-xs font-semibold">{day.temperature}°C</span>
        </div>
      </div>
    </div>
  )
}

export default function SpotDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { conditions, loading: conditionsLoading } = useSurfData()
  const { isPremium } = usePremium()

  const [spot, setSpot] = useState<BeachCondition|null>(null)
  const [loadingSpot, setLoadingSpot] = useState(true)
  const [favorite, setFavorite] = useState(false)
  const [loadingFav, setLoadingFav] = useState(true)
  const [forecast, setForecast] = useState<WeatherForecast[]>([])
  const [visible, setVisible] = useState(false)
  const [showScoreExplainer, setShowScoreExplainer] = useState(false)
  const [activeTab, setActiveTab] = useState<'agora'|'previsao'>('agora')
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [usesFeet, setUsesFeet] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pref_units') ?? '"metric"') === 'imperial' } catch { return false }
  })

  useEffect(() => {
    if (!id) return
    setForecast([])
    setVisible(false)
    if (conditionsLoading) return

    const found = conditions.find(s => s.id === id) ?? null
    setSpot(found)
    setLoadingSpot(false)
    setTimeout(() => setVisible(true), 50)

    if (found) {
      getWeatherForecast(
        found.id,
        { waveHeight: found.waveHeight, windSpeed: found.windSpeed, swellPeriod: found.swellPeriod, windDirection: found.windDirection, waterTemperature: found.waterConditions.temperature, score: found.score },
        isPremium
      ).then(setForecast)
    }

    isFavorite(id).then(val => { setFavorite(val); setLoadingFav(false) })
  }, [id, isPremium, conditions, conditionsLoading])

  if (loadingSpot) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <Waves className="h-12 w-12 mx-auto mb-4 text-primary animate-bounce"/>
        <p className="text-muted-foreground text-sm">Buscando condições em tempo real...</p>
      </div>
    </div>
  )

  if (!spot) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="max-w-md">
        <CardHeader><CardTitle>Praia não encontrada</CardTitle></CardHeader>
        <CardContent><Button onClick={() => navigate('/')}>Voltar para Home</Button></CardContent>
      </Card>
    </div>
  )

  const handleToggleFavorite = async () => {
    const newState = await toggleFavorite(spot.id, spot.name)
    setFavorite(newState)
    toast.success(newState ? '❤️ Adicionado aos favoritos!' : '💔 Removido dos favoritos')
  }

  const rating = getRatingInfo(spot.score)
  const windInfo = formatWindDirection(spot.windDirection)
  const airTemp = forecast.length > 0 ? forecast[0].temperature : null

  return (
    <div className="min-h-screen bg-background">
      {showScoreExplainer && <ScoreExplainer spot={spot} onClose={() => setShowScoreExplainer(false)}/>}

      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-2.5 max-w-4xl">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="flex-shrink-0 h-8 px-2">
              <ArrowLeft className="h-4 w-4 mr-1"/>Voltar
            </Button>
            <div className="flex-1 min-w-0 px-1">
              <p className="text-sm font-semibold truncate">{spot.name}</p>
              <p className="text-xs text-muted-foreground">{spot.region} da Ilha · {spot.level}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <ShareButton spot={spot}/>
              <button
                onClick={handleToggleFavorite}
                disabled={loadingFav}
                className={`p-2 rounded-xl border transition-colors ${favorite ? 'bg-red-500/10 border-red-500/40 text-red-500' : 'border-border hover:bg-muted/50'}`}
              >
                <Heart className={`h-4 w-4 ${favorite ? 'fill-current' : ''}`}/>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main
        className="container mx-auto px-4 py-5 pb-24 max-w-4xl space-y-5"
        style={{opacity:visible?1:0,transform:visible?'translateY(0)':'translateY(12px)',transition:'opacity 0.4s ease,transform 0.4s ease'}}
      >
        {/* Hero: score + métricas rápidas */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold leading-tight">{spot.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">{spot.region} da Ilha</span>
                <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">{spot.level}</span>
                {spot.bestTimeWindow && spot.bestTimeWindow !== 'Não recomendado hoje' && (
                  <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Clock className="h-3 w-3"/>{spot.bestTimeWindow}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowScoreExplainer(true)}
              className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl border border-border/50 bg-background p-3 min-w-[90px] hover:border-primary/40 transition-all active:scale-95"
            >
              <div className={`text-4xl font-bold leading-none ${rating.color}`}>{Number(spot.score).toFixed(1)}</div>
              <div className={`text-xs font-bold mt-1 ${rating.color}`}>{rating.label}</div>
              <div className="flex gap-0.5 mt-1.5">
                {[1,2,3,4,5].map(i=><div key={i} className={`h-1.5 w-4 rounded-full ${i<=rating.bars?rating.bg:'bg-muted'}`}/>)}
              </div>
              <div className="text-xs text-muted-foreground/50 mt-1.5">Score IA</div>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}&travelmode=driving`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 h-10 rounded-xl font-semibold text-sm text-white bg-primary hover:bg-primary/90 transition-all active:scale-95"
            >
              <Navigation className="h-4 w-4"/>Google Maps
            </a>
            <a
              href={`https://waze.com/ul?ll=${spot.lat},${spot.lng}&navigate=yes`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 h-10 rounded-xl font-semibold text-sm border border-border hover:bg-muted/50 transition-all active:scale-95"
            >
              <Navigation className="h-4 w-4"/>Waze
            </a>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="flex flex-col items-center gap-1 bg-muted/20 rounded-xl p-2.5">
              <Waves className="h-4 w-4 text-primary"/>
              <div className="text-base font-bold">{usesFeet ? metersToFeet(spot.waveHeight) : `${spot.waveHeight.toFixed(1)}m`}</div>
              <div className="text-xs text-muted-foreground text-center">Ondas</div>
            </div>
            <div className="flex flex-col items-center gap-1 bg-muted/20 rounded-xl p-2.5">
              <Wind className="h-4 w-4 text-accent"/>
              <div className="text-base font-bold">{Math.round(spot.windSpeed)}</div>
              <div className="text-xs text-muted-foreground text-center">km/h {windInfo.code}</div>
            </div>
            <div className="flex flex-col items-center gap-1 bg-muted/20 rounded-xl p-2.5">
              <Droplets className="h-4 w-4 text-cyan-500"/>
              <div className="text-base font-bold">{spot.waterConditions.temperature}°</div>
              <div className="text-xs text-muted-foreground text-center">Água</div>
            </div>
            <div className="flex flex-col items-center gap-1 bg-muted/20 rounded-xl p-2.5">
              <Sun className="h-4 w-4 text-rating-fair"/>
              <div className="text-base font-bold">{airTemp ? `${airTemp}°` : '—'}</div>
              <div className="text-xs text-muted-foreground text-center">Ar</div>
            </div>
          </div>
        </div>

        {/* Relatos */}
        <button
          onClick={() => setCommentsOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-border/50 bg-card hover:border-primary/30 hover:bg-primary/5 transition-all"
        >
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-primary"/>
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold">O que dizem quem foi hoje?</div>
              <div className="text-xs text-muted-foreground">Relatos ao vivo de quem está na praia</div>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${commentsOpen ? 'rotate-180' : ''}`}/>
        </button>
        {commentsOpen && (
          <div className="rounded-2xl border border-border/50 bg-card p-4" style={{animation:'slideUp 0.2s ease-out'}}>
            <CommentsSection spot={spot}/>
          </div>
        )}

        {/* Tabs Agora / Previsão */}
        <div className="flex rounded-xl bg-muted/30 p-1 border border-border/30">
          <button
            onClick={() => setActiveTab('agora')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'agora' ? 'bg-card shadow-sm text-foreground border border-border/40' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Waves className="h-4 w-4"/>Agora
          </button>
          <button
            onClick={() => setActiveTab('previsao')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'previsao' ? 'bg-card shadow-sm text-foreground border border-border/40' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Calendar className="h-4 w-4"/>Previsão
            {!isPremium && <Crown className="h-3 w-3 text-rating-fair"/>}
          </button>
        </div>

        {/* Aba Agora */}
        {activeTab === 'agora' && (
          <div className="space-y-5">
            <PicosSection spot={spot}/>

            <div className="grid grid-cols-2 gap-3">
              <Card className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-primary">
                    <Waves className="h-4 w-4"/>
                    <span className="text-sm font-semibold">Ondulação</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="text-3xl font-bold">
                      {usesFeet ? metersToFeet(spot.waveHeight) : `${spot.waveHeight.toFixed(1)}m`}
                    </div>
                    <button
                      onClick={() => setUsesFeet(!usesFeet)}
                      className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors mb-1"
                    >
                      {usesFeet ? 'm' : 'ft'}
                    </button>
                  </div>
                  <AnimatedProgress value={spot.waveHeight * 20}/>
                  <div className="pt-1 border-t border-border/30">
                    <div className="text-xs text-muted-foreground mb-1">Período</div>
                    <SwellPeriodBadge period={spot.swellPeriod}/>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Direção do Swell</div>
                    <div className="text-base font-semibold">{spot.swellDirection}</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-accent">
                    <Wind className="h-4 w-4"/>
                    <span className="text-sm font-semibold">Vento</span>
                  </div>
                  <WindCompass direction={spot.windDirection} speed={Math.round(spot.windSpeed)}/>
                  <AnimatedProgress value={Math.min(spot.windSpeed * 2.5, 100)}/>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-cyan-500"/>Como vai estar o mar hoje?
                </CardTitle>
              </CardHeader>
              <CardContent><TideChart tide={spot.tide}/></CardContent>
            </Card>

            <Alert className="bg-primary/5 border-primary/20">
              <TrendingUp className="h-4 w-4 text-primary"/>
              <AlertTitle className="text-primary text-sm">Análise Inteligente</AlertTitle>
              <AlertDescription className="text-foreground text-sm">{analyzeConditions(spot)}</AlertDescription>
            </Alert>

            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-1.5 text-foreground mb-1">
                  <Thermometer className="h-4 w-4"/>
                  <span className="text-sm font-semibold">Temperatura & Equipamento</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5"><Sun className="h-3 w-3"/>Ar</div>
                    <div className="text-2xl font-bold">{airTemp ? `${airTemp}°C` : '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5"><Droplets className="h-3 w-3"/>Água</div>
                    <div className="text-2xl font-bold">{spot.waterConditions.temperature}°C</div>
                  </div>
                </div>
                <Separator/>
                <div className="flex items-center gap-3">
                  <Waves className="h-4 w-4 text-muted-foreground flex-shrink-0"/>
                  <div>
                    <div className="text-xs text-muted-foreground">Neoprene</div>
                    <div className="text-sm font-semibold">{spot.waterConditions.wetsuit.thickness}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Compass className="h-4 w-4 text-muted-foreground flex-shrink-0"/>
                  <div>
                    <div className="text-xs text-muted-foreground">Prancha</div>
                    <div className="text-sm font-semibold">{spot.boardSuggestion}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {(spot.sunrise || spot.sunset) && (
              <Card className="bg-rating-fair/5 border-rating-fair/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 text-rating-fair mb-3">
                    <Sun className="h-4 w-4"/>
                    <span className="text-sm font-semibold">Luz do Dia</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground">🌅 Nascer do Sol</div>
                      <div className="text-lg font-semibold">{spot.sunrise}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">🌇 Pôr do Sol</div>
                      <div className="text-lg font-semibold">{spot.sunset}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {spot.score < 4 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4"/>
                <AlertTitle>Condições não ideais</AlertTitle>
                <AlertDescription>Este pico não está com boas condições. Considere outras praias ou aguarde melhora.</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Aba Previsão */}
        {activeTab === 'previsao' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Próximos dias</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isPremium ? '14 dias completos' : `${FREE_DAYS} dias gratuitos · Premium = 14 dias`}
                </p>
              </div>
              {!isPremium && (
                <button
                  onClick={() => navigate('/premium')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rating-fair/40 bg-rating-fair/10 text-rating-fair text-xs font-semibold hover:bg-rating-fair/15 transition-colors"
                >
                  <Crown className="h-3.5 w-3.5"/>Ver tudo
                </button>
              )}
            </div>

            {forecast.length === 0 ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <Waves className="h-5 w-5 text-primary animate-bounce"/>
                <span className="text-sm">Carregando previsão...</span>
              </div>
            ) : (
              <>
                {forecast[0]?.isFallback && (
                  <div className="flex items-center gap-2 text-xs text-rating-fair bg-rating-fair/10 border border-rating-fair/20 rounded-xl px-3 py-2">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0"/>
                    Previsão estimada — dados da API indisponíveis no momento.
                  </div>
                )}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {forecast.map((day, index) => (
                    <ForecastCard
                      key={day.date}
                      day={day}
                      index={index}
                      isPremium={isPremium}
                      usesFeet={usesFeet}
                      freeDays={FREE_DAYS}
                      onUpgrade={() => navigate('/premium')}
                    />
                  ))}
                </div>
                {!isPremium && (
                  <button
                    onClick={() => navigate('/premium')}
                    className="w-full py-4 rounded-2xl border border-dashed border-rating-fair/40 bg-rating-fair/5 hover:bg-rating-fair/10 transition-colors text-center"
                  >
                    <Crown className="h-5 w-5 text-rating-fair mx-auto mb-1"/>
                    <div className="text-sm font-semibold text-rating-fair">Ver previsão completa de 14 dias</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Assine o Premium por R$ 29,90/mês</div>
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <Button size="lg" variant="outline" className="w-full" onClick={() => navigate('/')}>
          Ver Todas as Praias
        </Button>
      </main>
    </div>
  )
}
