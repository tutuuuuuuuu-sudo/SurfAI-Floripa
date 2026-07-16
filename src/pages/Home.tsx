import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { SpotCard } from '@/components/surf/SpotCard'
import { OnboardingModal } from '@/components/OnboardingModal'
import { AppLogo } from '@/components/AppLogo'
import { AdBanner, AdCard } from '@/components/home/AdBanner'
import { SwellPeriodWidget } from '@/components/home/SwellPeriodWidget'
import { TrendBadge } from '@/components/home/TrendBadge'
import { SwellAlert } from '@/components/home/SwellAlert'
import { NotificationPanel } from '@/components/home/NotificationPanel'
import { analyzeConditions, BeachCondition, CENTRO_SPOT_IDS } from '@/lib/surfData'
import { useSurfData } from '@/contexts/SurfDataContext'
import { getFavorites } from '@/lib/favorites'
import { getLatestCommentsForSpots, LatestComment } from '@/lib/comments'
import { getValidationSummaries, ValidationSummary } from '@/lib/validations'
import { useAuth } from '@/contexts/AuthContext'
import { getUserDisplayName } from '@/lib/supabase'
import { usePremium } from '@/lib/premium'
import { fetchAIReport } from '@/lib/aiReport'
import { track } from '@/lib/monitoring'
import { getScoreColor, getThemeGradient } from '@/lib/rating'
import { getSavedNotificationSettings, checkAndNotifyGoodConditions } from '@/lib/notifications'
import { isTainhaSeasonActive } from '@/lib/tainha'
import {
  Waves, TrendingUp, MapPin, Info, Heart, Settings,
  Navigation, Crown, Sparkles, Flame, Fish
} from 'lucide-react'

export default function Home() {
  const [activeRegion, setActiveRegion] = useState<string>(() => {
    try { return (JSON.parse(localStorage.getItem('pref_region') ?? 'null') as string) ?? 'all' } catch { return 'all' }
  })
  const [topSpot, setTopSpot] = useState<BeachCondition | null>(null)
  const [favorites, setFavorites] = useState<string[]>([])
  const [visible, setVisible] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [aiReport, setAiReport] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem('onboarding_done') } catch { return true }
  })
  const [latestComments, setLatestComments] = useState<Record<string, LatestComment>>({})
  const [validations, setValidations] = useState<Record<string, ValidationSummary>>({})
  const aiReportFetchedRef = useRef(false)
  const premiumResolvedRef = useRef(false)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isPremium, loading: premiumLoading } = usePremium()
  const { conditions: allSpots, loading, lastUpdated, refresh } = useSurfData()

  const spots = useMemo(() => {
    let filtered = [...allSpots]
    if (activeRegion === 'Centro') filtered = filtered.filter(s => CENTRO_SPOT_IDS.includes(s.id as typeof CENTRO_SPOT_IDS[number]))
    else if (activeRegion !== 'all') filtered = filtered.filter(s => s.region === activeRegion)
    return filtered.sort((a, b) => b.score - a.score)
  }, [allSpots, activeRegion])

  // Atualiza top spot, favoritos e notificações sempre que os dados mudam
  useEffect(() => {
    if (allSpots.length === 0) return
    setFetchError(false)
    const sortedAll = [...allSpots].sort((a, b) => b.score - a.score)
    setTopSpot(sortedAll[0] ?? null)
    const t = setTimeout(() => setVisible(true), 100)

    getFavorites().catch(() => [] as string[]).then(favs => {
      setFavorites(favs)
      const notifSettings = getSavedNotificationSettings()
      if (notifSettings.enabled) {
        checkAndNotifyGoodConditions(allSpots, favs, notifSettings.minScore, notifSettings.favoriteOnly)
      }
    })
    // Busca o relato mais recente de cada praia em um único request
    const ids = allSpots.map(s => s.id)
    getLatestCommentsForSpots(ids).then(setLatestComments).catch(() => {})
    getValidationSummaries(ids).then(setValidations).catch(() => {})

    return () => clearTimeout(t)
  }, [allSpots])

  // Busca o relatório AI uma única vez — aguarda status premium ser resolvido
  useEffect(() => {
    if (premiumLoading) return
    // Reseta o ref quando o status premium resolve pela primeira vez,
    // garantindo que o fetch ocorra com o token correto (premium ou free)
    if (!premiumResolvedRef.current) {
      premiumResolvedRef.current = true
      aiReportFetchedRef.current = false
    }
    if (allSpots.length === 0 || aiReportFetchedRef.current) return
    aiReportFetchedRef.current = true
    const sortedAll = [...allSpots].sort((a, b) => b.score - a.score)
    const top = sortedAll[0]
    if (!top) return
    setAiLoading(true)
    const userLevel = (() => { try { return localStorage.getItem('pref_skill') ?? undefined } catch { return undefined } })()
    fetchAIReport(sortedAll.slice(0, 6), top, userLevel)
      .then(report => {
        setAiReport(report)
        if (report) track('ai_report_loaded', { top_spot: top.name, score: top.score })
      })
      .catch(() => {})
      .finally(() => setAiLoading(false))
  }, [allSpots, premiumLoading])

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
              <Button variant="outline" size="sm" onClick={() => navigate('/navigation')} className="hidden sm:flex">
                <Navigation className="h-4 w-4 mr-1.5" />Me Leva ao Pico
              </Button>
              <button onClick={() => navigate('/navigation')} className="sm:hidden p-2 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors" title="Me Leva ao Pico">
                <Navigation className="h-4 w-4 text-muted-foreground" />
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
          </div>
          <NotificationPanel spots={allSpots} favorites={favorites} />
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

        {(aiReport || aiLoading || (!premiumLoading && !isPremium && topSpot)) && (
          <Card className="border-primary/30 bg-primary/5 anim-slide" style={{ animationDelay: '0.15s' }}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />Relatório do dia — IA
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
              ) : aiReport ? (
                <div className="space-y-2">
                  <p className="text-sm text-foreground leading-relaxed">{aiReport}</p>
                  <p className="text-xs text-muted-foreground/50">Gerado por IA com base nos dados atuais. Confirme as condições antes de entrar no mar.</p>
                </div>
              ) : !isPremium && topSpot ? (
                // Prévia com blur para usuários free
                <div className="space-y-3">
                  <div className="relative">
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      As condições em {topSpot.name} estão {topSpot.score >= 7 ? 'excelentes' : topSpot.score >= 5.5 ? 'boas' : 'moderadas'} com ondas de {topSpot.waveHeight.toFixed(1)}m e período de {Math.round(topSpot.swellPeriod)}s. A análise completa indica a melhor janela do dia...
                    </p>
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card/90 to-transparent pointer-events-none" />
                  </div>
                  <div className="relative overflow-hidden rounded-lg">
                    <p className="text-sm text-muted-foreground leading-relaxed blur-sm select-none" aria-hidden>
                      O vento {topSpot.windDirection} favorece as ondas neste momento, com maré em condição ideal para surfistas de nível intermediário. Recomendamos chegar antes das 9h para aproveitar o melhor do swell.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/premium')}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors text-sm font-semibold text-primary"
                  >
                    <Crown className="h-4 w-4" />Ver relatório completo — Premium
                  </button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {topSpot && (
          <Card
            className="border-primary/20 card-hover cursor-pointer overflow-hidden"
            onClick={() => { track('spot_opened', { spot: topSpot.name, score: topSpot.score, source: 'top_spot' }); navigate(`/spot/${topSpot.id}`) }}
            style={{ animation: visible ? 'slideUp 0.5s 0.1s ease-out both' : 'none', background: `linear-gradient(135deg, hsl(var(--card)) 0%, ${getScoreColor(topSpot.score)}15 100%)`, borderColor: `${getScoreColor(topSpot.score)}40` }}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Flame className="h-5 w-5 text-orange-400" />Melhor Pico Agora
                  </CardTitle>
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

        {!isPremium && !premiumLoading && (
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
            <button
              key={region}
              onClick={() => setActiveRegion(region)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${activeRegion === region ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}
            >
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
                <SpotCard
                  spot={item as BeachCondition}
                  latestComment={latestComments[(item as BeachCondition).id]}
                  validation={validations[(item as BeachCondition).id]}
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
                    onClick={() => { setFetchError(false); refresh() }}
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
    </div>
  )
}
