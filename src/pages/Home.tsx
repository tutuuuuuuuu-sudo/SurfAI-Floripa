import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SpotCard } from '@/components/surf/SpotCard'
import { OnboardingModal } from '@/components/OnboardingModal'
import { AppLogo } from '@/components/AppLogo'
import { AdBanner, AdCard } from '@/components/home/AdBanner'
import { ConditionBadge } from '@/components/home/ConditionBadge'
import { SwellAlert } from '@/components/home/SwellAlert'
import { NotificationPanel } from '@/components/home/NotificationPanel'
import { GeoFinderCard } from '@/components/home/GeoFinderCard'
import { SurfChatPanel } from '@/components/home/SurfChatPanel'
import { PremiumUpsellBanner } from '@/components/PremiumUpsellBanner'
import { analyzeConditions, BeachCondition, formatWaveRange } from '@/lib/surfData'
import { useSurfData } from '@/contexts/SurfDataContext'
import { getFavorites } from '@/lib/favorites'
import { getLatestCommentsForSpots, LatestComment } from '@/lib/comments'
import { useAuth } from '@/contexts/AuthContext'
import { getUserDisplayName } from '@/lib/supabase'
import { usePremium } from '@/lib/premium'
import { track } from '@/lib/monitoring'
import { getScoreColor, getThemeGradient } from '@/lib/rating'
import { getSavedNotificationSettings, checkAndNotifyGoodConditions } from '@/lib/notifications'
import { isTainhaSeasonActive } from '@/lib/tainha'
import { isOnboardingDone } from '@/lib/onboarding'
import {
  Waves, TrendingUp, MapPin, Heart, Settings,
  Crown, Sparkles, Flame, Fish, GitCompareArrows,
  Sun, CloudSun, Cloud, CloudRain, CloudLightning, MessageCircle, ChevronRight
} from 'lucide-react'
import type { WeatherCondition } from '@/lib/weatherApi'

const WEATHER_ICONS: Record<WeatherCondition['icon'], typeof Sun> = {
  'sun': Sun, 'cloud-sun': CloudSun, 'cloud': Cloud, 'rain': CloudRain, 'storm': CloudLightning,
}

export default function Home() {
  const [activeRegion, setActiveRegion] = useState<string>(() => {
    const valid = ['all', 'Sul', 'Centro', 'Norte']
    try {
      const saved = JSON.parse(localStorage.getItem('pref_region') ?? 'null') as string
      return valid.includes(saved) ? saved : 'all'
    } catch { return 'all' }
  })
  const [topSpot, setTopSpot] = useState<BeachCondition | null>(null)
  const [favorites, setFavorites] = useState<string[]>([])
  const [visible, setVisible] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingDone())
  const [chatOpen, setChatOpen] = useState(false)
  const [latestComments, setLatestComments] = useState<Record<string, LatestComment>>({})
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isPremium, loading: premiumLoading } = usePremium()
  const { conditions: allSpots, loading, error: fetchError, lastUpdated, refresh } = useSurfData()

  const spots = useMemo(() => {
    let filtered = [...allSpots]
    if (activeRegion !== 'all') filtered = filtered.filter(s => s.region === activeRegion)
    return filtered.sort((a, b) => b.score - a.score)
  }, [allSpots, activeRegion])

  // Atualiza top spot, favoritos e notificações sempre que os dados mudam
  useEffect(() => {
    if (allSpots.length === 0) return
    const sortedAll = [...allSpots].sort((a, b) => b.score - a.score)
    setTopSpot(sortedAll[0] ?? null)
    const t = setTimeout(() => setVisible(true), 100)

    getFavorites().catch(() => [] as string[]).then(favs => {
      setFavorites(favs)
      const notifSettings = getSavedNotificationSettings()
      if (notifSettings.enabled) {
        checkAndNotifyGoodConditions(allSpots, favs, notifSettings.minScore, notifSettings.favoriteOnly, notifSettings.beachThresholds)
      }
    })
    // Busca o relato mais recente de cada praia em um único request
    const ids = allSpots.map(s => s.id)
    getLatestCommentsForSpots(ids).then(setLatestComments).catch(() => {})

    return () => clearTimeout(t)
  }, [allSpots])

  const userName = user ? getUserDisplayName(user) : 'Surfista'
  const userInitial = userName.charAt(0).toUpperCase()

  if (loading) return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <AppLogo size={40} variant="full" />
        </div>
      </header>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Waves className="h-12 w-12 text-primary animate-bounce" />
        <p className="text-muted-foreground text-sm">Buscando condições em tempo real...</p>
      </div>
    </div>
  )

  const spotsWithAds: (BeachCondition | 'ad')[] = (isPremium || premiumLoading)
    ? spots
    : spots.reduce<(BeachCondition | 'ad')[]>((acc, spot, idx) => {
        acc.push(spot)
        if ((idx + 1) % 3 === 0 && idx !== spots.length - 1) acc.push('ad')
        return acc
      }, [])

  return (
    <div className={`min-h-screen bg-gradient-to-b ${topSpot ? getThemeGradient(topSpot.score) : 'bg-background'}`}>

      {showOnboarding && <OnboardingModal onDone={() => setShowOnboarding(false)} />}

      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3" style={{ animation: 'slideInLeft 0.4s ease-out' }}>
              <AppLogo size={40} variant="full" />
            </div>
            <div className="flex items-center gap-2" style={{ animation: 'slideInRight 0.4s ease-out' }}>
              <Button variant={favorites.length > 0 ? 'default' : 'outline'} size="sm" onClick={() => navigate('/favorites')} className="hidden sm:flex">
                <Heart className={`h-4 w-4 mr-1.5 ${favorites.length > 0 ? 'fill-current' : ''}`} />
                {favorites.length > 0 ? `Favoritas (${favorites.length})` : 'Favoritas'}
              </Button>
              <button
                onClick={() => navigate('/favorites')}
                className="sm:hidden relative p-2 rounded-xl border border-border hover:bg-muted/50 transition-colors"
                title="Favoritas"
              >
                <Heart className={`h-4 w-4 ${favorites.length > 0 ? 'fill-destructive text-destructive' : ''}`} />
                {favorites.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
                    {favorites.length}
                  </span>
                )}
              </button>

              {!isPremium && !premiumLoading && (
                <>
                  <Button variant="outline" size="sm" onClick={() => navigate('/premium')} className="hidden sm:flex border-rating-fair/50 text-rating-fair hover:bg-rating-fair/10">
                    <Crown className="h-4 w-4 mr-1.5" />Premium
                  </Button>
                  <button onClick={() => navigate('/premium')} className="sm:hidden p-2 rounded-xl border border-rating-fair/50 hover:bg-rating-fair/10 transition-colors" title="Premium">
                    <Crown className="h-4 w-4 text-rating-fair" />
                  </button>
                </>
              )}

              <button onClick={() => navigate('/profile')} className="relative w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center hover:bg-primary/30 transition-colors">
                {user?.user_metadata?.avatar_url
                  ? <img src={user.user_metadata.avatar_url as string} alt={userName} className="w-full h-full rounded-full object-cover" />
                  : <span className="text-xs font-bold text-primary">{userInitial}</span>
                }
                {isPremium && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rating-fair flex items-center justify-center">
                    <Crown className="h-2.5 w-2.5 text-white" />
                  </div>
                )}
              </button>

              <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 pb-24 space-y-6">
        <div className="flex items-center justify-between" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease' }}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span>Atualizado às {(lastUpdated ?? new Date()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            {topSpot?.weatherCondition && (() => {
              const WeatherIcon = WEATHER_ICONS[topSpot.weatherCondition.icon]
              return (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <WeatherIcon className="h-3.5 w-3.5" />
                  <span>{topSpot.weatherCondition.label}</span>
                </>
              )
            })()}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/compare')}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
            >
              <GitCompareArrows className="h-3.5 w-3.5" />Comparar praias
            </button>
            <NotificationPanel spots={allSpots} favorites={favorites} isPremium={isPremium} />
          </div>
        </div>

        <SwellAlert spots={allSpots} />

        {isTainhaSeasonActive() && (
          <div className="flex items-start gap-3 bg-rating-fair/10 border border-rating-fair/30 rounded-xl px-4 py-3 anim-slide" style={{ animationDelay: '0.12s' }}>
            <Fish className="h-5 w-5 text-rating-fair flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-semibold text-rating-fair">Temporada da Tainha</span>
              <span className="text-sm text-muted-foreground ml-2">Várias praias com restrição até 31 de julho. Verifique o status em cada pico.</span>
            </div>
          </div>
        )}

        {!premiumLoading && (
          <div className="anim-slide" style={{ animationDelay: '0.15s' }}>
            {isPremium ? (
              <div className="relative">
                <div className="absolute -inset-1 rounded-2xl bg-primary/25 blur-md animate-pulse pointer-events-none" />
                <button
                  onClick={() => { track('surf_chat_opened'); setChatOpen(true) }}
                  className="relative w-full text-left rounded-2xl border border-primary/50 bg-primary/8 shadow-lg shadow-primary/15 p-4 hover:bg-primary/12 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-base flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />Converse com o Surf AI
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Bateu alguma dúvida sobre o mar hoje? Pergunta pro Surf AI e recebe a resposta na hora.
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-primary flex-shrink-0" />
                  </div>
                </button>
              </div>
            ) : (
              <PremiumUpsellBanner
                title="Converse com o Surf AI"
                subtitle="Bateu alguma dúvida sobre o mar hoje? Pergunta pro Surf AI, recurso exclusivo Premium"
              />
            )}
          </div>
        )}

        {topSpot && (
          <Card
            className="border-primary/20 card-hover cursor-pointer overflow-hidden"
            onClick={() => { track('spot_opened', { spot: topSpot.name, score: topSpot.score, source: 'top_spot' }); navigate(`/spot/${topSpot.id}`) }}
            style={{
              animation: visible ? 'slideUp 0.5s 0.1s ease-out both' : 'none',
              background: `linear-gradient(135deg, var(--card) 0%, color-mix(in oklch, ${getScoreColor(topSpot.score)} 15%, var(--card)) 100%)`,
              borderColor: `color-mix(in oklch, ${getScoreColor(topSpot.score)} 40%, transparent)`,
            }}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Flame className="h-5 w-5 text-rating-fair" />Melhor Pico Agora
                  </CardTitle>
                </div>
                <ConditionBadge spot={topSpot} size="lg" />
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
                  <div className="text-xs text-muted-foreground">Nota IA</div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                <div><div className="text-xs text-muted-foreground">Ondas</div><div className="text-lg font-semibold">{formatWaveRange(topSpot.waveHeight)}</div></div>
                <div><div className="text-xs text-muted-foreground">Período</div><div className="text-lg font-semibold">{Math.round(topSpot.swellPeriod)}s</div></div>
                <div><div className="text-xs text-muted-foreground">Maré</div><div className="text-lg font-semibold">{topSpot.tide}</div></div>
                <div><div className="text-xs text-muted-foreground">Água</div><div className="text-lg font-semibold">{topSpot.waterConditions.temperature}°C</div></div>
              </div>
            </CardContent>
          </Card>
        )}

        {allSpots.length > 0 && (
          <GeoFinderCard spots={allSpots} isPremium={isPremium} />
        )}

        {!isPremium && !premiumLoading && (
          <div className="anim-slide" style={{ animationDelay: '0.25s' }}>
            <AdBanner />
          </div>
        )}

        <div className="flex items-center justify-between anim-slide" style={{ animationDelay: '0.4s' }}>
          <h2 className="text-xl font-bold">Todas as Praias</h2>
          <Button variant={favorites.length > 0 ? 'default' : 'outline'} size="sm" onClick={() => navigate('/favorites')}>
            <Heart className={`h-4 w-4 mr-2 ${favorites.length > 0 ? 'fill-current' : ''}`} />
            {favorites.length > 0 ? `${favorites.length}` : 'Favoritas'}
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 anim-slide" style={{ animationDelay: '0.42s' }}>
          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
          {(['all', 'Sul', 'Centro', 'Norte'] as const).map(region => (
            <button
              key={region}
              onClick={() => setActiveRegion(region)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${activeRegion === region ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}
            >
              {{ all: 'Todas', Sul: 'Sul', Centro: 'Centro', Norte: 'Norte' }[region]}
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
                <SpotCard
                  spot={item as BeachCondition}
                  latestComment={latestComments[(item as BeachCondition).id]}
                />
              </div>
            )
          )}
          {spots.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Waves className="h-12 w-12 mx-auto mb-4 opacity-20" />
              {fetchError ? (
                <>
                  <p className="font-medium">Erro ao carregar as condições.</p>
                  <p className="text-sm mt-1">Verifique sua conexão e tente novamente.</p>
                  <button
                    onClick={refresh}
                    className="mt-4 text-sm text-primary border border-primary/30 px-4 py-2 rounded-xl hover:bg-primary/10 transition-colors"
                  >
                    Tentar novamente
                  </button>
                </>
              ) : (
                <p>Nenhuma praia encontrada nesta região.</p>
              )}
            </div>
          )}
        </div>
      </main>

      <SurfChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        spots={[...allSpots].sort((a, b) => b.score - a.score)}
        userLevel={(() => { try { return localStorage.getItem('pref_skill') ?? undefined } catch { return undefined } })()}
        userName={userName}
      />
    </div>
  )
}
