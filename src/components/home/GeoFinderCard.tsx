import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Compass, MapPin, Loader2, Navigation, GitCompareArrows } from 'lucide-react'
import { recommendBeach, type GeoRecommendation } from '@/lib/geoFinder'
import { getScoreColor, getRatingInfo } from '@/lib/rating'
import { track } from '@/lib/monitoring'
import { PremiumUpsellBanner } from '@/components/PremiumUpsellBanner'
import type { BeachCondition } from '@/lib/surfData'

type Status = 'idle' | 'requesting' | 'denied' | 'unsupported' | 'unavailable' | 'timeout' | 'error' | 'result'

interface Props {
  spots: BeachCondition[]
  isPremium: boolean
}

const mapsUrl = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
const wazeUrl = (lat: number, lng: number) => `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`

// Praia com múltiplos picos tem UMA coordenada "principal" cadastrada (às vezes é a de um
// pico específico, ex: Campeche → Lomba do Sabão, ver surfData.ts) — mandar o usuário pro
// Maps/Waze com essa coordenada sem dizer qual pico é gera confusão real (reportado pelo
// usuário 31/ago/2026: Surfline sugeriu Campeche, o pino caiu na Lomba, sem indicação
// nenhuma de que existiam outros picos como Palanque ou Principal). `subRegions[].bestNow`
// já vem calculado em surfData.ts (mesmo dado que PicosSection.tsx usa na página da praia)
// — aqui só reaproveita: se a praia tem sub-picos, navega pro pico com melhor match agora,
// não pra coordenada genérica da praia, e mostra o nome dele.
function bestPicoFor(beachId: string, spots: BeachCondition[]): { lat: number; lng: number; picoName: string | null } | null {
  const spot = spots.find(s => s.id === beachId)
  if (!spot?.subRegions?.length) return null
  const best = spot.subRegions.find(s => s.bestNow) ?? spot.subRegions[0]
  return { lat: best.lat, lng: best.lng, picoName: best.name }
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      // Desktop sem GPS localiza por Wi-Fi/IP, que pode demorar mais que os 10s
      // originais — 20s dá folga sem deixar o botão preso indefinidamente.
      timeout: 20000,
      maximumAge: 5 * 60 * 1000,
    })
  })
}

export function GeoFinderCard({ spots, isPremium }: Props) {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<GeoRecommendation | null>(null)

  const handleFindNearby = async () => {
    if (!('geolocation' in navigator)) { setStatus('unsupported'); return }
    setStatus('requesting')
    try {
      const position = await getPosition()
      const rec = recommendBeach(spots, position.coords.latitude, position.coords.longitude)
      if (!rec) { setStatus('error'); return }
      setResult(rec)
      setStatus('result')
      track('geo_finder_used', { worthDetour: rec.worthDetour, recommended: rec.recommended.id })
    } catch (err) {
      // Códigos do GeolocationPositionError: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE
      // (serviço de localização do sistema/navegador desligado), 3 = TIMEOUT.
      if (err instanceof GeolocationPositionError) {
        if (err.code === err.PERMISSION_DENIED) setStatus('denied')
        else if (err.code === err.POSITION_UNAVAILABLE) setStatus('unavailable')
        else if (err.code === err.TIMEOUT) setStatus('timeout')
        else setStatus('error')
      } else {
        setStatus('error')
      }
    }
  }

  if (!isPremium) {
    return (
      <PremiumUpsellBanner
        title="Onde Surfar Agora é Premium"
        subtitle="A gente compara as praias mais perto de você e mostra pra onde vale ir agora"
      />
    )
  }

  return (
    <Card className="border-primary/20 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          Onde Surfar Agora
        </CardTitle>
        <CardDescription className="text-xs">
          A gente compara as praias mais perto de você e mostra pra onde vale ir agora
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === 'idle' && (
          <>
            <p className="text-xs text-muted-foreground">
              Compartilha sua localização só por esse instante (não guardamos nada) e a gente te diz pra onde ir.
            </p>
            <Button variant="outline" size="sm" className="w-full" onClick={handleFindNearby}>
              <MapPin className="h-4 w-4 mr-2" />Usar minha localização
            </Button>
          </>
        )}

        {status === 'requesting' && (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />Buscando sua localização...
          </div>
        )}

        {status === 'denied' && (
          <p className="text-xs text-muted-foreground">
            Localização bloqueada. Se quiser usar esse recurso, permita o acesso à localização nas configurações do navegador e tente de novo.
          </p>
        )}

        {status === 'unsupported' && (
          <p className="text-xs text-muted-foreground">Seu navegador não suporta localização.</p>
        )}

        {status === 'unavailable' && (
          <>
            <p className="text-xs text-muted-foreground">
              Não conseguimos localizar você. Verifique se o serviço de localização está ligado no computador ou celular (não só no navegador) e tente de novo.
            </p>
            <Button variant="outline" size="sm" className="w-full" onClick={handleFindNearby}>
              <MapPin className="h-4 w-4 mr-2" />Tentar de novo
            </Button>
          </>
        )}

        {status === 'timeout' && (
          <>
            <p className="text-xs text-muted-foreground">Demorou demais pra localizar você. Sinal fraco costuma ser o motivo, vale tentar de novo.</p>
            <Button variant="outline" size="sm" className="w-full" onClick={handleFindNearby}>
              <MapPin className="h-4 w-4 mr-2" />Tentar de novo
            </Button>
          </>
        )}

        {status === 'error' && (
          <p className="text-xs text-muted-foreground">Não deu pra obter sua localização agora. Tente de novo mais tarde.</p>
        )}

        {status === 'result' && result && (() => {
          const recInfo = getRatingInfo(result.recommended.score)
          const recColor = getScoreColor(result.recommended.score)
          const recPico = bestPicoFor(result.recommended.id, spots)
          const goToRecommended = () => {
            track('spot_opened', { spot: result.recommended.name, source: 'geo_finder' })
            navigate(`/spot/${result.recommended.id}`)
          }

          // Sem desvio que valha a pena: só a recomendação, sem comparação pra não confundir.
          if (!result.worthDetour) {
            return (
              <div className="space-y-2">
                <div className={`rounded-xl border ${recInfo.bg}/10 border-primary/20 hover:border-primary/40 transition-colors overflow-hidden`}>
                  <button className="w-full text-left p-3" onClick={goToRecommended}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{result.recommended.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{result.recommended.distanceKm.toFixed(1)}km de você</div>
                        {recPico?.picoName && (
                          <div className="text-xs text-primary mt-0.5">Pico: {recPico.picoName}</div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xl font-bold" style={{ color: recColor }}>{result.recommended.score.toFixed(1)}</div>
                        <div className="text-[10px] font-bold" style={{ color: recColor }}>{recInfo.label}</div>
                      </div>
                    </div>
                  </button>
                  <NavButtons lat={recPico?.lat ?? result.recommended.lat} lng={recPico?.lng ?? result.recommended.lng} />
                </div>
                {!result.recommendedIsGood && (
                  <p className="text-xs text-muted-foreground px-0.5">
                    Nenhuma praia por perto está com boa condição agora. Essa é a menos ruim.
                  </p>
                )}
              </div>
            )
          }

          // Vale o desvio: mostra as duas opções lado a lado, cada uma com nome e
          // distância próprios (não uma diferença pro usuário calcular de cabeça), e um
          // veredito em português simples explicando a troca.
          const nearInfo = getRatingInfo(result.nearest.score)
          const nearColor = getScoreColor(result.nearest.score)
          const nearPico = bestPicoFor(result.nearest.id, spots)
          const goToNearest = () => {
            track('spot_opened', { spot: result.nearest.name, source: 'geo_finder' })
            navigate(`/spot/${result.nearest.id}`)
          }
          const goToCompare = () => {
            track('geo_finder_compare_opened', { nearest: result.nearest.id, recommended: result.recommended.id })
            navigate(`/compare?spot=${result.nearest.id}&spot2=${result.recommended.id}`)
          }
          return (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border/40 hover:bg-muted/20 transition-colors overflow-hidden">
                  <button className="w-full text-left p-3" onClick={goToNearest}>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Mais perto</div>
                    <div className="text-sm font-semibold leading-tight">{result.nearest.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{result.nearest.distanceKm.toFixed(1)}km de você</div>
                    {nearPico?.picoName && (
                      <div className="text-[10px] text-primary mt-0.5">Pico: {nearPico.picoName}</div>
                    )}
                    <div className="text-base font-bold mt-1.5" style={{ color: nearColor }}>
                      {result.nearest.score.toFixed(1)} <span className="text-[10px] font-bold">{nearInfo.label}</span>
                    </div>
                  </button>
                  <NavButtons lat={nearPico?.lat ?? result.nearest.lat} lng={nearPico?.lng ?? result.nearest.lng} />
                </div>
                <div className="rounded-xl border-2 border-primary/50 bg-primary/5 hover:bg-primary/10 transition-colors overflow-hidden">
                  <button className="w-full text-left p-3" onClick={goToRecommended}>
                    <div className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1.5">Vale o desvio</div>
                    <div className="text-sm font-semibold leading-tight">{result.recommended.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{result.recommended.distanceKm.toFixed(1)}km de você</div>
                    {recPico?.picoName && (
                      <div className="text-[10px] text-primary mt-0.5">Pico: {recPico.picoName}</div>
                    )}
                    <div className="text-base font-bold mt-1.5" style={{ color: recColor }}>
                      {result.recommended.score.toFixed(1)} <span className="text-[10px] font-bold">{recInfo.label}</span>
                    </div>
                  </button>
                  <NavButtons lat={recPico?.lat ?? result.recommended.lat} lng={recPico?.lng ?? result.recommended.lng} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground px-0.5">
                {result.extraDistanceKm < 1.5
                  // Desvio pequeno (achado 24/ago/2026: "vale rodar 0.4km a mais" soava sem
                  // sentido — 0.4km não é um desvio de verdade, é praticamente a mesma
                  // distância). Nesse caso o motivo de ir pra lá é só a condição, não a rota.
                  ? <>{result.nearest.name} e {result.recommended.name} ficam praticamente na
                      mesma distância, mas {result.recommended.name} está {recInfo.label.toLowerCase()},
                      bem melhor que {result.nearest.name} ({nearInfo.label.toLowerCase()}). Vale ir direto pra lá.</>
                  : <>{result.nearest.name} é a praia mais perto, mas o mar tá {nearInfo.label.toLowerCase()} lá agora.
                      Vale rodar mais {result.extraDistanceKm.toFixed(1)}km até {result.recommended.name}.</>
                }
              </p>
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={goToCompare}>
                <GitCompareArrows className="h-3.5 w-3.5 mr-1.5" />Comparar as duas praias
              </Button>
            </div>
          )
        })()}
      </CardContent>
    </Card>
  )
}

// Leva direto pro Maps/Waze a partir do próprio card, sem precisar abrir a praia e depois
// achar o botão de rota lá dentro (achado 24/ago/2026, reportado pelo usuário: usuário já
// decide "vou nessa" só de ver a recomendação, mas tinha que ir até a aba "Me Leva" e
// procurar a praia de novo pra navegar até ela).
function NavButtons({ lat, lng }: { lat: number; lng: number }) {
  // Antes: bg-background (quase preto no dark mode) + texto de 10px, sem contraste nenhum
  // com o resto do card — reportado pelo usuário 31/ago/2026 ("botões pretos, quase não dá
  // pra ver"). Reaproveita o mesmo padrão já usado em PicosSection.tsx (Maps sólido na cor
  // primária, Waze com borda), que já tinha contraste bom — só não estava sendo usado aqui.
  return (
    <div className="grid grid-cols-2 gap-2 p-2 pt-0" onClick={e => e.stopPropagation()}>
      <a
        href={mapsUrl(lat, lng)} target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary/90 transition-colors"
      >
        <Navigation className="h-3.5 w-3.5" />Maps
      </a>
      <a
        href={wazeUrl(lat, lng)} target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border border-border hover:bg-muted/50 transition-colors"
      >
        <Navigation className="h-3.5 w-3.5" />Waze
      </a>
    </div>
  )
}
