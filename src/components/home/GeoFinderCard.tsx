import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Compass, MapPin, Loader2 } from 'lucide-react'
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
        title="Bora Surfar é Premium"
        subtitle="O Surf AI encontra a praia com as melhores condições mais perto de você"
      />
    )
  }

  return (
    <Card className="border-primary/20 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          Bora Surfar?
        </CardTitle>
        <CardDescription className="text-xs">
          O Surf AI encontra a praia com as melhores condições mais perto de você
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === 'idle' && (
          <>
            <p className="text-xs text-muted-foreground">
              Compartilha sua localização só por esse instante — não guardamos nada — e a gente te diz pra onde ir.
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
            <p className="text-xs text-muted-foreground">Demorou demais pra localizar você. Sinal fraco costuma ser o motivo — vale tentar de novo.</p>
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
          const goToRecommended = () => {
            track('spot_opened', { spot: result.recommended.name, source: 'geo_finder' })
            navigate(`/spot/${result.recommended.id}`)
          }

          // Sem desvio que valha a pena: só a recomendação, sem comparação pra não confundir.
          if (!result.worthDetour) {
            return (
              <button
                className="w-full text-left rounded-xl p-3 border border-border/40 hover:border-primary/40 transition-colors"
                onClick={goToRecommended}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{result.recommended.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{result.recommended.distanceKm.toFixed(1)}km de você</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xl font-bold" style={{ color: recColor }}>{result.recommended.score.toFixed(1)}</div>
                    <div className="text-[10px] font-bold" style={{ color: recColor }}>{recInfo.label}</div>
                  </div>
                </div>
              </button>
            )
          }

          // Vale o desvio: mostra as duas opções lado a lado, cada uma com nome e
          // distância próprios (não uma diferença pro usuário calcular de cabeça), e um
          // veredito em português simples explicando a troca.
          const nearInfo = getRatingInfo(result.nearest.score)
          const nearColor = getScoreColor(result.nearest.score)
          return (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border/40 p-3">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Mais perto</div>
                  <div className="text-sm font-semibold leading-tight">{result.nearest.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{result.nearest.distanceKm.toFixed(1)}km de você</div>
                  <div className="text-base font-bold mt-1.5" style={{ color: nearColor }}>
                    {result.nearest.score.toFixed(1)} <span className="text-[10px] font-bold">{nearInfo.label}</span>
                  </div>
                </div>
                <button
                  className="rounded-xl border-2 border-primary/50 bg-primary/5 p-3 text-left hover:bg-primary/10 transition-colors"
                  onClick={goToRecommended}
                >
                  <div className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1.5">Vale o desvio</div>
                  <div className="text-sm font-semibold leading-tight">{result.recommended.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{result.recommended.distanceKm.toFixed(1)}km de você</div>
                  <div className="text-base font-bold mt-1.5" style={{ color: recColor }}>
                    {result.recommended.score.toFixed(1)} <span className="text-[10px] font-bold">{recInfo.label}</span>
                  </div>
                </button>
              </div>
              <p className="text-xs text-muted-foreground px-0.5">
                {result.nearest.name} é a praia mais perto, mas o mar tá {nearInfo.label.toLowerCase()} lá agora.
                Vale rodar {result.extraDistanceKm.toFixed(1)}km a mais até {result.recommended.name}.
              </p>
            </div>
          )
        })()}
      </CardContent>
    </Card>
  )
}
