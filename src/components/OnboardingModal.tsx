import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AppLogo } from '@/components/AppLogo'
import { Anchor, Zap, TrendingUp, Sun, Moon, Crown, MapPin } from 'lucide-react'
import { toggleFavorite } from '@/lib/favorites'
import { useSurfData } from '@/contexts/SurfDataContext'
import { getScoreColor } from '@/lib/rating'
import { captureError } from '@/lib/monitoring'
import { markOnboardingDone } from '@/lib/onboarding'

type SkillLevel = 'Iniciante' | 'Intermediário' | 'Avançado'
type TimeSlot = 'manha' | 'tarde' | 'qualquer'

const LEVELS: { value: SkillLevel; icon: typeof Anchor; desc: string; sub: string }[] = [
  { value: 'Iniciante',     icon: Anchor,     desc: 'Prefiro ondas pequenas e calmas', sub: 'Até 0.8m · vento fraco' },
  { value: 'Intermediário', icon: TrendingUp, desc: 'Me viro bem em ondas médias',      sub: 'Até 1.5m · qualquer vento' },
  { value: 'Avançado',      icon: Zap,        desc: 'Quanto maior e mais forte, melhor', sub: 'Qualquer tamanho' },
]

const TIME_SLOTS: { value: TimeSlot; icon: typeof Sun; label: string; sub: string }[] = [
  { value: 'manha',    icon: Sun,      label: 'Manhã',    sub: 'Entre 6h e 11h' },
  { value: 'tarde',    icon: Moon,     label: 'Tarde',    sub: 'Entre 13h e 18h' },
  { value: 'qualquer', icon: TrendingUp, label: 'Qualquer', sub: 'Quando estiver boa' },
]

interface Props {
  onDone: () => void
}

export function OnboardingModal({ onDone }: Props) {
  const navigate = useNavigate()
  const { conditions } = useSurfData()
  const [step, setStep] = useState(1)
  const [level, setLevel] = useState<SkillLevel | null>(null)
  const [favoriteSpotId, setFavoriteSpotId] = useState<string | null>(null)
  const [timeSlot, setTimeSlot] = useState<TimeSlot | null>(null)

  // Ordena por score, mas mostra todas — é uma escolha pessoal, não um ranking a filtrar
  const topSpots = [...conditions].sort((a, b) => b.score - a.score)
  const chosenSpot = conditions.find(s => s.id === favoriteSpotId)

  const handleDone = async (skip = false) => {
    try {
      if (!skip) {
        if (level) localStorage.setItem('pref_skill', JSON.stringify(level))
        if (timeSlot && timeSlot !== 'qualquer') localStorage.setItem('pref_time_slot', timeSlot)
        if (favoriteSpotId) await toggleFavorite(favoriteSpotId, chosenSpot?.name ?? favoriteSpotId)
      }
    } catch { /* favorito falhou ou modo privado — segue para gravar onboarding_done mesmo assim */ }
    markOnboardingDone()
    // Alguns navegadores (Safari em certos modos) aceitam o setItem sem lançar erro, mas não persistem de verdade.
    try {
      if (localStorage.getItem('onboarding_done') !== '1') {
        captureError(new Error('onboarding_done não persistiu no localStorage — usando fallback em memória'), { context: 'OnboardingModal.handleDone' })
      }
    } catch (err) {
      captureError(err, { context: 'OnboardingModal.handleDone localStorage indisponível' })
    }
    onDone()
  }

  const handleNext = () => setStep(s => s + 1)

  const totalSteps = 3

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 anim-slide pb-4">

        {/* Logo + progresso */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <AppLogo size={56} variant="icon" />
          </div>
          <div>
            <h2 className="text-2xl font-black">
              {step === 1 && 'Bem-vindo ao Surf AI!'}
              {step === 2 && 'Qual sua praia?'}
              {step === 3 && 'Quando você prefere surfar?'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {step === 1 && 'Uma pergunta rápida para personalizar suas recomendações'}
              {step === 2 && 'Vamos já adicionar nos favoritos para você'}
              {step === 3 && 'Para te alertar no horário certo'}
            </p>
          </div>
          {/* Indicador de passo */}
          <div className="flex items-center justify-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i + 1 === step ? 'w-6 bg-primary' : i + 1 < step ? 'w-3 bg-primary/50' : 'w-3 bg-muted'}`} />
            ))}
          </div>
        </div>

        {/* Passo 1 — Nível */}
        {step === 1 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-3">
              Qual é o seu nível de surf?
            </p>
            {LEVELS.map(({ value, icon: Icon, desc, sub }) => (
              <button
                key={value}
                onClick={() => setLevel(value)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                  level === value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 hover:bg-muted/20'
                }`}
              >
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${level === value ? 'bg-primary/20' : 'bg-muted/40'}`}>
                  <Icon className={`h-5 w-5 ${level === value ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm">{value}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                  <div className="text-xs text-muted-foreground/60 mt-0.5">{sub}</div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${level === value ? 'border-primary bg-primary' : 'border-border'}`}>
                  {level === value && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Passo 2 — Praia favorita */}
        {step === 2 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-3">
              Qual praia você surfa mais?
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {topSpots.map(spot => (
                <button
                  key={spot.id}
                  onClick={() => setFavoriteSpotId(spot.id)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                    favoriteSpotId === spot.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: getScoreColor(spot.score) }}
                  >
                    {spot.score.toFixed(1)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{spot.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-0.5">
                      <MapPin className="h-2.5 w-2.5" />{spot.region}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {topSpots.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Carregando praias...</p>
            )}
          </div>
        )}

        {/* Passo 3 — Horário preferido */}
        {step === 3 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-3">
              Quando você prefere surfar?
            </p>
            {TIME_SLOTS.map(({ value, icon: Icon, label, sub }) => (
              <button
                key={value}
                onClick={() => setTimeSlot(value)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                  timeSlot === value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 hover:bg-muted/20'
                }`}
              >
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${timeSlot === value ? 'bg-primary/20' : 'bg-muted/40'}`}>
                  <Icon className={`h-5 w-5 ${timeSlot === value ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm">{label}</div>
                  <div className="text-xs text-muted-foreground">{sub}</div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${timeSlot === value ? 'border-primary bg-primary' : 'border-border'}`}>
                  {timeSlot === value && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>
            ))}

            {/* Teaser: score atual da praia escolhida */}
            {chosenSpot && (
              <div
                className="flex items-center gap-3 p-3 rounded-xl border mt-2"
                style={{ borderColor: getScoreColor(chosenSpot.score) + '50', backgroundColor: getScoreColor(chosenSpot.score) + '12' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: getScoreColor(chosenSpot.score) }}
                >
                  {chosenSpot.score.toFixed(1)}
                </div>
                <div>
                  <div className="text-xs font-semibold">{chosenSpot.name} agora</div>
                  <div className="text-xs text-muted-foreground">{chosenSpot.waveHeight.toFixed(1)}m · {Math.round(chosenSpot.windSpeed)}km/h vento</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Botões de ação */}
        <div className="space-y-2">
          {step < totalSteps ? (
            <Button
              className="w-full h-12 text-base font-bold"
              onClick={handleNext}
              disabled={step === 1 && !level}
            >
              Continuar
            </Button>
          ) : (
            <>
              <Button
                className="w-full h-12 text-base font-bold"
                onClick={() => handleDone(false)}
                disabled={!timeSlot}
              >
                Começar a surfar
              </Button>
              <button
                onClick={() => { handleDone(false); navigate('/premium') }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rating-fair/5 border border-rating-fair/20 hover:bg-rating-fair/10 transition-colors text-sm text-rating-fair font-medium"
              >
                <Crown className="h-4 w-4" />Ver o que é Premium
              </button>
            </>
          )}
          <button
            onClick={() => handleDone(true)}
            className="w-full text-xs text-muted-foreground text-center py-2 hover:text-foreground transition-colors"
          >
            Pular por agora
          </button>
        </div>

      </div>
    </div>
  )
}
