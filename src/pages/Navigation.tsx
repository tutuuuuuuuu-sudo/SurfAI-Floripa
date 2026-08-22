import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BeachCondition } from '@/lib/surfData'
import { useSurfData } from '@/contexts/SurfDataContext'
import { ArrowLeft, Navigation, Waves, MapPin, ExternalLink, Wind, Timer, Thermometer, Map, Car, Apple } from 'lucide-react'

import { getScoreColor, getScoreLabel } from '@/lib/rating'
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock'

const getLocationDesc = (id: string): string => {
  const map: Record<string, string> = {
    'campeche': 'Sul da Ilha', 'morro-pedras': 'Sul da Ilha',
    'matadeiro': 'Sul da Ilha', 'lagoinha-leste': 'Extremo Sul', 'acores': 'Extremo Sul',
    'solidao': 'Extremo Sul', 'armacao': 'Sul da Ilha', 'naufragados': 'Extremo Sul',
    'joaquina': 'Centro', 'mole': 'Centro', 'mocambique': 'Norte da Ilha',
    'barra-lagoa': 'Centro', 'novo-campeche': 'Centro', 'santinho': 'Norte da Ilha',
  }
  return map[id] ?? 'Florianópolis'
}

// Sub-picos do Campeche com coordenadas bem na areia
const CAMPECHE_SUBSPOTS = [
  { id: 'lomba-sabao', name: 'Lomba do Sabão', lat: -27.697703,  lng: -48.4898603 },
  { id: 'palanque',    name: 'Palanque',        lat: -27.6820,   lng: -48.4830 },
  { id: 'principal',   name: 'Principal',       lat: -27.6893,   lng: -48.4825 },
]

// ✅ NUNCA passa origem na URL — Maps/Waze/Apple sempre detectam a posição atual do dispositivo
// Passar origin causa o bug onde usa um ponto fixo errado em vez da posição real do usuário
const openNavigation = (destLat: number, destLng: number, app: 'google' | 'waze' | 'apple') => {
  const urls = {
    // Sem &origin= → Google Maps usa "Sua localização" (GPS do dispositivo)
    google: `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`,
    // Waze sempre usa GPS do dispositivo quando não tem origem
    waze: `https://waze.com/ul?ll=${destLat},${destLng}&navigate=yes&zoom=17`,
    // Apple Maps usa localização atual do dispositivo
    apple: `maps://maps.apple.com/?daddr=${destLat},${destLng}&dirflg=d`,
  }
  window.open(urls[app], '_blank')
}

const NavModal = ({
  name, score, beachId, lat, lng, hikeAccess,
  waveHeight, windSpeed, swellPeriod, waterTemp, onClose
}: {
  name: string; score: number; beachId: string; lat: number; lng: number; hikeAccess?: boolean
  waveHeight: number; windSpeed: number; swellPeriod: number; waterTemp: number; onClose: () => void
}) => {
  const color = getScoreColor(score)
  const isCampeche = beachId === 'campeche'
  const [selectedSubspot, setSelectedSubspot] = useState<typeof CAMPECHE_SUBSPOTS[0] | null>(null)
  useBodyScrollLock(true)

  const activeLat = selectedSubspot?.lat ?? lat
  const activeLng = selectedSubspot?.lng ?? lng



  return (
    <div
      className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-end justify-center p-4"
      onClick={onClose}
      style={{ animation: 'fadeIn 0.2s ease-out' }}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden mb-4"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        {/* Header */}
        <div className="p-5 border-b" style={{ borderColor: color + '30', background: color + '10' }}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-bold">{name}</h2>
            <div className="text-2xl font-bold" style={{ color }}>{score.toFixed(1)}</div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{getLocationDesc(beachId)}</span>
            <span>·</span>
            <span style={{ color }}>{getScoreLabel(score)}</span>
          </div>
          <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Waves className="h-3 w-3" />{waveHeight.toFixed(1)}m</span>
            <span className="flex items-center gap-1"><Wind className="h-3 w-3" />{Math.round(windSpeed)}km/h</span>
            <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{Math.round(swellPeriod)}s</span>
            <span className="flex items-center gap-1"><Thermometer className="h-3 w-3" />{waterTemp}°C</span>
          </div>

          {/* O Maps/Waze detecta automaticamente a posição do dispositivo */}
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-rating-good animate-pulse" />
            <span>Rota a partir da sua posição atual</span>
          </div>
        </div>

        {/* Sub-picos do Campeche */}
        {isCampeche && (
          <div className="px-5 pt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Escolha o pico do Campeche:</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {CAMPECHE_SUBSPOTS.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubspot(selectedSubspot?.id === sub.id ? null : sub)}
                  className={`py-2 px-2 rounded-xl border text-xs font-medium transition-all ${
                    selectedSubspot?.id === sub.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Trilha warning */}
        {hikeAccess && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rating-fair/10 border border-rating-fair/30 text-xs text-rating-fair">
            Acesso por trilha: o GPS leva até o ponto de partida da trilha, não à areia.
          </div>
        )}

        {/* Botões de navegação */}
        <div className="p-5 space-y-3">
          <button
            onClick={() => openNavigation(activeLat, activeLng, 'google')}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Map className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold text-sm group-hover:text-primary transition-colors">Google Maps</div>
              <div className="text-xs text-muted-foreground">Abre com rota a partir de você</div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>

          <button
            onClick={() => openNavigation(activeLat, activeLng, 'waze')}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-secondary/50 hover:bg-secondary/5 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
              <Car className="h-5 w-5 text-secondary" />
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold text-sm group-hover:text-secondary transition-colors">Waze</div>
              <div className="text-xs text-muted-foreground">Melhor para trânsito em tempo real</div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-secondary transition-colors" />
          </button>

          <button
            onClick={() => openNavigation(activeLat, activeLng, 'apple')}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-foreground/30 hover:bg-muted/40 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
              <Apple className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold text-sm group-hover:text-foreground transition-colors">Apple Maps</div>
              <div className="text-xs text-muted-foreground">Para usuários iPhone/iPad</div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/20 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NavigationPage() {
  const navigate = useNavigate()
  const { conditions, loading } = useSurfData()
  const spots = useMemo(() => [...conditions].sort((a, b) => b.score - a.score), [conditions])
  const [selectedSpot, setSelectedSpot] = useState<BeachCondition | null>(null)
  const [activeRegion, setActiveRegion] = useState<string>('all')

  const regions = ['all', 'Sul', 'Centro', 'Norte']
  const regionLabels: Record<string, string> = { all: 'Todas', Sul: 'Sul', Centro: 'Centro', Norte: 'Norte' }
  const filtered = activeRegion === 'all'
    ? spots
    : spots.filter(s => s.region === activeRegion)

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />Voltar
            </Button>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Navigation className="h-5 w-5 text-primary" />
              Me Leva ao Pico
            </h1>
            <div className="w-16" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
        <div className="text-center py-2">
          <p className="text-sm text-muted-foreground">Escolha uma praia e te levamos até lá 🤙</p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {regions.map(r => (
            <button
              key={r}
              onClick={() => setActiveRegion(r)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${
                activeRegion === r
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              }`}
            >
              {regionLabels[r]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Waves className="h-10 w-10 text-primary animate-bounce" />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((spot, idx) => {
              const color = getScoreColor(spot.score)
              return (
                <Card
                  key={spot.id}
                  className="cursor-pointer hover:border-primary/40 transition-all active:scale-[0.98]"
                  style={{ animation: `slideInLeft 0.3s ${idx * 0.04}s ease-out both` }}
                  onClick={() => setSelectedSpot(spot)}
                >
                  <CardContent className="py-4 px-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-white text-sm"
                        style={{ backgroundColor: color }}
                      >
                        {spot.score.toFixed(1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold">{spot.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          {getLocationDesc(spot.id)}
                          {spot.hikeAccess && <span className="text-rating-fair">· via trilha</span>}
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Waves className="h-3 w-3" />{spot.waveHeight.toFixed(1)}m</span>
                          <span className="flex items-center gap-1"><Wind className="h-3 w-3" />{Math.round(spot.windSpeed)}km/h</span>
                          <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{Math.round(spot.swellPeriod)}s</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/30">
                          <Navigation className="h-5 w-5 text-primary" />
                        </div>
                        <span className="text-xs text-primary font-medium">Ir</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>

      {selectedSpot && (
        <NavModal
          name={selectedSpot.name}
          score={selectedSpot.score}
          beachId={selectedSpot.id}
          lat={selectedSpot.lat}
          lng={selectedSpot.lng}
          hikeAccess={selectedSpot.hikeAccess}
          waveHeight={selectedSpot.waveHeight}
          windSpeed={selectedSpot.windSpeed}
          swellPeriod={selectedSpot.swellPeriod}
          waterTemp={selectedSpot.waterConditions.temperature}
          onClose={() => setSelectedSpot(null)}
        />
      )}
    </div>
  )
}
