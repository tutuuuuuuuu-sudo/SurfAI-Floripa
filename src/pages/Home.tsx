import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SpotCard } from '@/components/surf/SpotCard'
import { OnboardingModal } from '@/components/OnboardingModal'
import { fetchCurrentConditions, analyzeConditions, BeachCondition } from '@/lib/surfData'
import { getFavorites } from '@/lib/favorites'
import { useAuth } from '@/contexts/AuthContext'
import { getUserDisplayName } from '@/lib/supabase'
import { usePremium } from '@/lib/premium'
import { fetchAIReport } from '@/lib/aiReport'
import { getScoreColor, getThemeGradient } from '@/lib/rating'
import {
  subscribeToNotifications,
  getNotificationPermission,
  getSavedNotificationSettings,
  saveNotificationSettings,
  checkAndNotifyGoodConditions
} from '@/lib/notifications'
import { AppLogo } from '@/components/AppLogo'
import {
  Waves, TrendingUp, TrendingDown, Minus, MapPin, Info, Heart, Settings,
  Bell, BellOff, X, ChevronDown, ChevronUp, Navigation, Crown, Sparkles,
  Flame, Store
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'


interface AdData {
  id: string; empresa: string; slogan: string; imagem_url: string; link_url: string
}

const PLACEHOLDER_AD: AdData = {
  id: 'placeholder', empresa: 'Sua Empresa Aqui',
  slogan: 'Anuncie para surfistas de Floripa • surfaifloripa@gmail.com',
  imagem_url: '', link_url: 'mailto:surfaifloripa@gmail.com',
}

const AdBanner = ({ ad = PLACEHOLDER_AD }: { ad?: AdData }) => (
  <a href={ad.link_url} target={ad.id === 'placeholder' ? '_self' : '_blank'} rel="noopener noreferrer"
    className="block w-full rounded-xl border border-border/40 overflow-hidden hover:border-primary/30 transition-all" style={{ textDecoration: 'none' }}>
    <div className="flex items-center gap-3 px-4 py-3 bg-muted/10">
      {ad.imagem_url
        ? <img src={ad.imagem_url} alt={ad.empresa} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
        : <div className="w-12 h-12 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0"><Waves className="h-6 w-6 text-muted-foreground" /></div>
      }
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold truncate">{ad.empresa}</div>
        <div className="text-xs text-muted-foreground truncate">{ad.slogan}</div>
      </div>
      <span className="text-xs text-muted-foreground/50 bg-muted/20 px-2 py-0.5 rounded-full flex-shrink-0">Patrocinado</span>
    </div>
  </a>
)

const AdCard = ({ ad = PLACEHOLDER_AD }: { ad?: AdData }) => (
  <a href={ad.link_url} target={ad.id === 'placeholder' ? '_self' : '_blank'} rel="noopener noreferrer"
    className="block" style={{ textDecoration: 'none' }}>
    <div className="rounded-xl border border-dashed border-border/50 hover:border-primary/30 bg-muted/5 hover:bg-primary/5 transition-all p-4 flex items-center gap-3">
      {ad.imagem_url
        ? <img src={ad.imagem_url} alt={ad.empresa} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
        : <div className="w-10 h-10 rounded-lg bg-muted/20 flex items-center justify-center flex-shrink-0"><Store className="h-5 w-5 text-muted-foreground" /></div>
      }
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate">{ad.empresa}</div>
        <div className="text-xs text-muted-foreground truncate">{ad.slogan}</div>
      </div>
      <span className="text-xs text-muted-foreground/40 flex-shrink-0">Patrocinado</span>
    </div>
  </a>
)

const SwellPeriodWidget = () => {
  const [open, setOpen] = useState(false)
  const periods = [
    { range: '< 8s', label: 'Fraco', color: '#ef4444', desc: 'Vento local, ondas curtas e bagunçadas. Difícil de surfar.' },
    { range: '8-10s', label: 'Regular', color: '#f59e0b', desc: 'Ondulação moderada. Surfável mas sem muita qualidade.' },
    { range: '10-12s', label: 'Bom', color: '#22c55e', desc: 'Boa ondulação. Ondas bem formadas e com energia.' },
    { range: '12-14s', label: 'Muito Bom', color: '#06b6d4', desc: 'Excelente! Ondas longas, limpas e com muito poder.' },
    { range: '> 14s', label: 'Épico', color: '#8b5cf6', desc: 'Swell de longo período. Ondas perfeitas e muito potentes.' },
  ]
  return (
    <Card className="border-primary/20 bg-primary/5 card-hover anim-slide" style={{ animationDelay: '0.3s' }}>
      <button className="w-full text-left" onClick={() => setOpen(!open)}>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Waves className="h-4 w-4 text-primary" />O que significa o período do swell?
            </CardTitle>
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardHeader>
      </button>
      {open && (
        <CardContent className="px-4 pb-4 space-y-2" style={{ animation: 'slideUp 0.3s ease-out' }}>
          <p className="text-xs text-muted-foreground mb-3">O período é o tempo em segundos entre duas ondas consecutivas. Quanto maior, mais organizada e poderosa é a ondulação.</p>
          <div className="space-y-2">
            {periods.map(p => (
              <div key={p.range} className="flex items-start gap-3">
                <div className="min-w-[52px] text-xs font-bold rounded px-1.5 py-0.5 text-center text-white" style={{ backgroundColor: p.color }}>{p.range}</div>
                <div>
                  <span className="text-xs font-semibold" style={{ color: p.color }}>{p.label}</span>
                  <span className="text-xs text-muted-foreground ml-1">— {p.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// getScoreColor e getThemeGradient agora vêm de @/lib/rating

function getTrend(spot: BeachCondition): 'up' | 'down' | 'stable' {
  const hour = new Date().getHours()
  if (hour >= 5 && hour <= 9) return spot.windSpeed <= 15 ? 'up' : 'stable'
  if (hour >= 14 && hour <= 18) return spot.windSpeed >= 15 ? 'down' : 'stable'
  return 'stable'
}

const TrendBadge = ({ spot, size = 'sm' }: { spot: BeachCondition, size?: 'sm' | 'lg' }) => {
  const trend = getTrend(spot)
  if (trend === 'stable') return (
    <span className={`inline-flex items-center gap-1 ${size === 'lg' ? 'text-sm' : 'text-xs'} text-muted-foreground`}>
      <Minus className={size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'} />Estável
    </span>
  )
  if (trend === 'up') return (
    <span className={`inline-flex items-center gap-1 ${size === 'lg' ? 'text-sm' : 'text-xs'} text-green-500 font-semibold`}>
      <TrendingUp className={size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'} />Melhorando
    </span>
  )
  return (
    <span className={`inline-flex items-center gap-1 ${size === 'lg' ? 'text-sm' : 'text-xs'} text-orange-400 font-semibold`}>
      <TrendingDown className={size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'} />Piorando
    </span>
  )
}

const SwellAlert = ({ spots }: { spots: BeachCondition[] }) => {
  const [dismissed, setDismissed] = useState(false)
  const bigSwellSpots = spots.filter(s => s.waveHeight >= 1.5)
  if (bigSwellSpots.length === 0 || dismissed) return null
  const best = bigSwellSpots.sort((a, b) => b.waveHeight - a.waveHeight)[0]
  return (
    <div className="relative bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 rounded-xl p-4 flex items-start gap-3 anim-slide" style={{ animationDelay: '0.1s' }}>
      <Waves className="h-6 w-6 text-primary flex-shrink-0" />
      <div className="flex-1">
        <div className="font-bold text-sm">Swell grande chegando!</div>
        <div className="text-xs text-muted-foreground mt-0.5">{best.name} com ondas de {best.waveHeight.toFixed(1)}m — período de {Math.round(best.swellPeriod)}s</div>
      </div>
      <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>
    </div>
  )
}

const NotificationPanel = ({ spots, favorites }: { spots: BeachCondition[], favorites: string[] }) => {
  const [permission, setPermission] = useState(getNotificationPermission())
  const [settings, setSettings] = useState(getSavedNotificationSettings())
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

  const handleEnable = async () => {
    setLoading(true)
    const success = await subscribeToNotifications()
    if (success) { const s = { ...settings, enabled: true }; setSettings(s); saveNotificationSettings(s); setPermission('granted') }
    setLoading(false)
  }
  const handleDisable = () => { const s = { ...settings, enabled: false }; setSettings(s); saveNotificationSettings(s) }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-colors ${settings.enabled && permission === 'granted' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'}`}>
      {settings.enabled && permission === 'granted' ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
      {settings.enabled && permission === 'granted' ? 'Alertas ativos' : 'Alertas'}
    </button>
  )

  return (
    <Card className="border-primary/20" style={{ animation: 'slideUp 0.3s ease-out' }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />Alertas de Condições</CardTitle>
          <button onClick={() => setOpen(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isIOS && <div className="text-xs bg-muted/30 border border-border rounded-lg p-3 text-muted-foreground">😤 <strong>iPhone/iPad:</strong> O Safari no iOS não suporta notificações push em aplicações web.</div>}
        {!isIOS && permission === 'unsupported' && <p className="text-xs text-muted-foreground">Seu navegador não suporta notificações. Tente pelo Chrome.</p>}
        {!isIOS && permission === 'denied' && <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3">Notificações bloqueadas. Clique no cadeado na barra de endereços e permita.</div>}
        {!isIOS && (permission === 'default' || permission === 'granted') && (
          <>
            <div className="flex items-center justify-between">
              <div><div className="text-sm font-semibold">Receber alertas</div><div className="text-xs text-muted-foreground">Quando as condições estiverem boas</div></div>
              <button onClick={settings.enabled && permission === 'granted' ? handleDisable : handleEnable} disabled={loading}
                className={`relative w-11 h-6 rounded-full transition-colors ${settings.enabled && permission === 'granted' ? 'bg-primary' : 'bg-muted'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.enabled && permission === 'granted' ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <Separator />
            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold mb-2">Score mínimo</div>
                <div className="flex gap-2">
                  {[6, 7, 8, 9].map(score => (
                    <button key={score} onClick={() => { const s = { ...settings, minScore: score }; setSettings(s); saveNotificationSettings(s) }}
                      className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${settings.minScore === score ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border text-muted-foreground'}`}>{score}+</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold">Só favoritas</div>
                <button onClick={() => { const s = { ...settings, favoriteOnly: !settings.favoriteOnly }; setSettings(s); saveNotificationSettings(s) }}
                  className={`relative w-11 h-6 rounded-full transition-colors ${settings.favoriteOnly ? 'bg-primary' : 'bg-muted'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.favoriteOnly ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>
            {settings.enabled && permission === 'granted' && (
              <button onClick={() => checkAndNotifyGoodConditions(spots, favorites, settings.minScore, settings.favoriteOnly)}
                className="w-full text-xs py-2 border border-primary/30 rounded-lg text-primary hover:bg-primary/10 transition-colors">Testar notificação</button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

const CENTRO_IDS = ['novo-campeche', 'joaquina', 'mole', 'barra-lagoa']

export default function Home() {
  const [activeRegion, setActiveRegion] = useState<string>('all')
  const [allSpots, setAllSpots] = useState<BeachCondition[]>([])
  const [topSpot, setTopSpot] = useState<BeachCondition | null>(null)
  const lastUpdated = useRef<Date>(new Date())
  const [loading, setLoading] = useState(true)
  const [favorites, setFavorites] = useState<string[]>([])
  const [visible, setVisible] = useState(false)
  const [aiReport, setAiReport] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem('onboarding_done') } catch { return false }
  })
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isPremium } = usePremium()

  // Filtragem por região é derivada — não precisa de estado separado
  const spots = useMemo(() => {
    let filtered = [...allSpots]
    if (activeRegion === 'Centro') filtered = filtered.filter(s => CENTRO_IDS.includes(s.id))
    else if (activeRegion !== 'all') filtered = filtered.filter(s => s.region === activeRegion)
    return filtered.sort((a, b) => b.score - a.score)
  }, [allSpots, activeRegion])

  useEffect(() => {
    setLoading(true)
    const updateData = async () => {
      lastUpdated.current = new Date()
      const allConditions = await fetchCurrentConditions()
      const favs = await getFavorites()
      setFavorites(favs)
      const sortedAll = [...allConditions].sort((a, b) => b.score - a.score)
      const top = sortedAll[0] ?? null
      setAllSpots(allConditions)
      setTopSpot(top)
      setLoading(false)
      setTimeout(() => setVisible(true), 100)
      const notifSettings = getSavedNotificationSettings()
      if (notifSettings.enabled) await checkAndNotifyGoodConditions(allConditions, favs, notifSettings.minScore, notifSettings.favoriteOnly)
      if (top) {
        setAiLoading(true)
        try {
          const userLevel = localStorage.getItem('pref_skill') ?? undefined
          const report = await fetchAIReport(sortedAll.slice(0, 6), top, userLevel ?? undefined)
          setAiReport(report)
        } catch { /* silently fail */ }
        setAiLoading(false)
      }
    }
    updateData()
    const interval = setInterval(updateData, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const userName = user ? getUserDisplayName(user) : 'Surfista'
  const userInitial = userName.charAt(0).toUpperCase()

  if (loading) return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo size={40} variant="full" />
          </div>
        </div>
      </header>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Waves className="h-12 w-12 text-primary animate-bounce" />
        <p className="text-muted-foreground text-sm">Buscando condições em tempo real...</p>
      </div>
    </div>
  )

  const spotsWithAds: (BeachCondition | 'ad')[] = isPremium
    ? spots
    : spots.reduce<(BeachCondition | 'ad')[]>((acc, spot, idx) => {
        acc.push(spot)
        if ((idx + 1) % 3 === 0 && idx !== spots.length - 1) acc.push('ad')
        return acc
      }, [])

  return (
    <div className={`min-h-screen bg-gradient-to-b ${topSpot ? getThemeGradient(topSpot.score) : 'bg-background'}`}>

      {showOnboarding && <OnboardingModal onDone={() => setShowOnboarding(false)} />}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3" style={{ animation: 'slideInLeft 0.4s ease-out' }}>
              <AppLogo size={40} variant="full" />
            </div>
            <div className="flex items-center gap-2" style={{ animation: 'slideInRight 0.4s ease-out' }}>
              <Button variant="outline" size="sm" onClick={() => navigate('/navigation')} className="hidden sm:flex">
                <Navigation className="h-4 w-4 mr-1.5" />Me Leva ao Pico
              </Button>
              <button onClick={() => navigate('/navigation')} className="sm:hidden p-2 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors" title="Me Leva ao Pico">
                <Navigation className="h-4 w-4 text-muted-foreground" />
              </button>

              {!isPremium && (
                <>
                  <Button variant="outline" size="sm" onClick={() => navigate('/premium')} className="hidden sm:flex border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10">
                    <Crown className="h-4 w-4 mr-1.5" />Premium
                  </Button>
                  <button onClick={() => navigate('/premium')} className="sm:hidden p-2 rounded-xl border border-yellow-500/50 hover:bg-yellow-500/10 transition-colors" title="Premium">
                    <Crown className="h-4 w-4 text-yellow-500" />
                  </button>
                </>
              )}

              <button onClick={() => navigate('/profile')} className="relative w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center hover:bg-primary/30 transition-colors">
                {user?.user_metadata?.avatar_url
                  ? <img src={user.user_metadata.avatar_url as string} alt={userName} className="w-full h-full rounded-full object-cover" />
                  : <span className="text-xs font-bold text-primary">{userInitial}</span>
                }
                {isPremium && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center">
                    <Crown className="h-2.5 w-2.5 text-white" />
                  </div>
                )}
              </button>

              <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}><Settings className="h-5 w-5" /></Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 pb-24 space-y-6">
        <div className="flex items-center justify-between" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease' }}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span>Atualizado às {lastUpdated.current.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <NotificationPanel spots={allSpots} favorites={favorites} />
        </div>

        <SwellAlert spots={allSpots} />

        {/* Card de relatório de IA */}
        {(aiReport || aiLoading) && (
          <Card className="border-primary/30 anim-slide" style={{ animationDelay: '0.15s', background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--primary)/.05) 100%)' }}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Relatório do dia — IA
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {aiLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.4s' }} />
                  <span>Analisando condições com IA...</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed">{aiReport}</p>
              )}
            </CardContent>
          </Card>
        )}

        {topSpot && (
          <Card className="border-primary/20 card-hover cursor-pointer overflow-hidden" onClick={() => navigate(`/spot/${topSpot.id}`)}
            style={{ animation: visible ? 'slideUp 0.5s 0.1s ease-out both' : 'none', background: `linear-gradient(135deg, hsl(var(--card)) 0%, ${getScoreColor(topSpot.score)}15 100%)`, borderColor: `${getScoreColor(topSpot.score)}40` }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg flex items-center gap-2"><Flame className="h-5 w-5 text-orange-400" />Melhor Pico Agora</CardTitle>
                </div>
                <TrendBadge spot={topSpot} size="lg" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-1">{topSpot.name}</h3>
                  <Badge variant="outline" className="mb-2"><MapPin className="h-3 w-3 mr-1" />{topSpot.region} da Ilha</Badge>
                  <p className="text-sm text-muted-foreground leading-relaxed">{analyzeConditions(topSpot)}</p>
                </div>
                <div className="text-center bg-card/80 rounded-lg p-4 border">
                  <div className="text-4xl font-bold" style={{ color: getScoreColor(topSpot.score) }}>{Number(topSpot.score).toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">Score IA</div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                <div><div className="text-xs text-muted-foreground">Ondas</div><div className="text-lg font-semibold">{Number(topSpot.waveHeight).toFixed(1)}m</div></div>
                <div><div className="text-xs text-muted-foreground">Período</div><div className="text-lg font-semibold">{Math.round(topSpot.swellPeriod)}s</div></div>
                <div><div className="text-xs text-muted-foreground">Maré</div><div className="text-lg font-semibold">{topSpot.tide}</div></div>
                <div><div className="text-xs text-muted-foreground">Água</div><div className="text-lg font-semibold">{topSpot.waterConditions.temperature}°C</div></div>
              </div>
            </CardContent>
          </Card>
        )}

        {!isPremium && (
          <div className="anim-slide" style={{ animationDelay: '0.25s' }}>
            <AdBanner />
          </div>
        )}

        <SwellPeriodWidget />

        <Alert className="anim-slide" style={{ animationDelay: '0.35s' }}>
          <Info className="h-4 w-4" />
          <AlertDescription>A Inteligência Artificial analisa vento, swell, maré, batimetria e orientação das praias para indicar onde está melhor para surfar agora.</AlertDescription>
        </Alert>

        <div className="flex items-center justify-between anim-slide" style={{ animationDelay: '0.4s' }}>
          <h2 className="text-xl font-bold">Todas as Praias</h2>
          <Button variant={favorites.length > 0 ? 'default' : 'outline'} size="sm" onClick={() => navigate('/favorites')}>
            <Heart className={`h-4 w-4 mr-2 ${favorites.length > 0 ? 'fill-current' : ''}`} />
            {favorites.length > 0 ? `${favorites.length}` : 'Favoritas'}
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 anim-slide" style={{ animationDelay: '0.42s' }}>
          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
          {(['all', 'Sul', 'Centro', 'Leste', 'Norte'] as const).map(region => (
            <button key={region} onClick={() => setActiveRegion(region)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${activeRegion === region ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
              {{ all: 'Todas', Sul: 'Sul', Centro: 'Centro', Leste: 'Leste', Norte: 'Norte' }[region]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {spotsWithAds.map((item, idx) =>
            item === 'ad' ? (
              <div key={`ad-${idx}`} className="col-span-1 md:col-span-2 lg:col-span-3" style={{ animation: `slideUp 0.4s ${idx * 0.03}s ease-out both` }}>
                <AdCard />
              </div>
            ) : (
              <div key={(item as BeachCondition).id} style={{ animation: `slideUp 0.4s ${idx * 0.05}s ease-out both` }}>
                <SpotCard spot={item as BeachCondition} />
              </div>
            )
          )}
          {spots.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Waves className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhuma praia encontrada nesta região.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
