import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BeachCondition, CENTRO_SPOT_IDS } from '@/lib/surfData'
import { useSurfData } from '@/contexts/SurfDataContext'
import { ArrowLeft, Navigation, Waves, MapPin, ExternalLink, Wind, Timer, Thermometer, Map, Car, Apple } from 'lucide-react'

import { getScoreColor, getRatingInfo } from '@/lib/rating'

const getScoreLabel = (score: number): string => getRatingInfo(score).label.charAt(0) + getRatingInfo(score).label.slice(1).toLowerCase()

const getLocationDesc = (id: string): string => {
  const map: Record<string, string> = {
    'campeche': 'Sul da Ilha', 'morro-pedras': 'Sul da Ilha',
    'matadeiro': 'Sul da Ilha', 'lagoinha-leste': 'Extremo Sul', 'acores': 'Extremo Sul',
    'solidao': 'Extremo Sul', 'armacao': 'Sul da Ilha', 'naufragados': 'Extremo Sul',
    'joaquina': 'Centro', 'mole': 'Centro', 'mocambique': 'Leste da Ilha',
    'barra-lagoa': 'Centro', 'novo-campeche': 'Centro', 'santinho': 'Norte da Ilha',
  }
  return map[id] ?? 'Florianópolis'
}

// ✅ Coordenadas BEM NA AREIA de cada praia (verificadas no Google Maps)
// Praias com trilha: Matadeiro, Lagoinha, Naufragados — levam ao estacionamento/início da trilha
const BEACH_DESTINATIONS: Record<string, { lat: number, lng: number, name: string, hasTrilha?: boolean }> = {
  'campeche':       { lat: -27.697703,  lng: -48.4898603, name: 'Praia do Campeche — Lomba do Sabão' },
  'novo-campeche':  { lat: -27.6661001, lng: -48.4755307, name: 'Praia do Novo Campeche' },
  'morro-pedras':   { lat: -27.7170897, lng: -48.5034360, name: 'Praia do Morro das Pedras' },
  'matadeiro':      { lat: -27.7548429, lng: -48.4985647, name: 'Praia do Matadeiro', hasTrilha: true },
  'lagoinha-leste': { lat: -27.7732103, lng: -48.4863806, name: 'Lagoinha do Leste', hasTrilha: true },
  'acores':         { lat: -27.7837144, lng: -48.5236746, name: 'Praia dos Açores' },
  'solidao':        { lat: -27.7941233, lng: -48.5334965, name: 'Praia da Solidão' },
  'armacao':        { lat: -27.7504078, lng: -48.5017637, name: 'Praia da Armação' },
  'naufragados':    { lat: -27.8335587, lng: -48.5641537, name: 'Praia de Naufragados', hasTrilha: true },
  'joaquina':       { lat: -27.6293577, lng: -48.4490173, name: 'Praia da Joaquina' },
  'mole':           { lat: -27.6022459, lng: -48.4326839, name: 'Praia Mole' },
  'mocambique':     { lat: -27.4937746, lng: -48.3955175, name: 'Praia do Moçambique' },
  'barra-lagoa':    { lat: -27.5734502, lng: -48.4249390, name: 'Praia da Barra da Lagoa' },
  'santinho':       { lat: -27.4618653, lng: -48.3761513, name: 'Praia do Santinho' },
}

// Sub-picos do Campeche com coordenadas bem na areia
const CAMPECHE_SUBSPOTS = [
  { id: 'lomba-sabao', name: 'Lomba do Sabão', lat: -27.697703,  lng: -48.4898603 },
  { id: 'palanque',    name: 'Palanque',        lat: -27.6820,   lng: -48.4830 },
  { id: 'principal',   name: 'Principal',       lat: -27.6622150, lng: -48.4734326 },
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
  name, score, beachId, lat, lng,
  waveHeight, windSpeed, swellPeriod, waterTemp, onClose
}: {
  name: string; score: number; beachId: string; lat: number; lng: number
  waveHeight: number; windSpeed: number; swellPeriod: number; waterTemp: number; onClose: () => void
}) => {
  const color = getScoreColor(score)
  const isCampeche = beachId === 'campeche'
  const [selectedSubspot, setSelectedSubspot] = useState<typeof CAMPECHE_SUBSPOTS[0] | null>(null)


  const dest = BEACH_DESTINATIONS[beachId] ?? { lat, lng, name }
  const activeLat = selectedSubspot?.lat ?? dest.lat
  const activeLng = selectedSubspot?.lng ?? dest.lng



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
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
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
        {dest.hasTrilha && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-600 dark:text-yellow-400">
            Acesso por trilha — o GPS leva até o ponto de partida da trilha, não à areia.
          </div>
        )}

        {/* Botões de navegação */}
        <div className="p-5 space-y-3">
          <button
            onClick={() => openNavigation(activeLat, activeLng, 'google')}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Map className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold text-sm group-hover:text-blue-500 transition-colors">Google Maps</div>
              <div className="text-xs text-muted-foreground">Abre com rota a partir de você</div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 transition-colors" />
          </button>

          <button
            onClick={() => openNavigation(activeLat, activeLng, 'waze')}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
              <Car className="h-5 w-5 text-cyan-500" />
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold text-sm group-hover:text-cyan-500 transition-colors">Waze</div>
              <div className="text-xs text-muted-foreground">Melhor para trânsito em tempo real</div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-cyan-500 transition-colors" />
          </button>

          <button
            onClick={() => openNavigation(activeLat, activeLng, 'apple')}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-gray-400/50 hover:bg-gray-400/5 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-400/10 flex items-center justify-center flex-shrink-0">
              <Apple className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold text-sm group-hover:text-gray-300 transition-colors">Apple Maps</div>
              <div className="text-xs text-muted-foreground">Para usuários iPhone/iPad</div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-gray-300 transition-colors" />
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

  const regions = ['all', 'Sul', 'Centro', 'Leste', 'Norte']
  const regionLabels: Record<string, string> = { all: 'Todas', Sul: 'Sul', Centro: 'Centro', Leste: 'Leste', Norte: 'Norte' }
  const filtered = activeRegion === 'all'
    ? spots
    : activeRegion === 'Centro'
      ? spots.filter(s => CENTRO_SPOT_IDS.includes(s.id as typeof CENTRO_SPOT_IDS[number]))
      : spots.filter(s => s.region === activeRegion && !CENTRO_SPOT_IDS.includes(s.id as typeof CENTRO_SPOT_IDS[number]))

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
              const dest = BEACH_DESTINATIONS[spot.id]
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
                          {dest?.hasTrilha && <span className="text-yellow-500">· via trilha</span>}
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
