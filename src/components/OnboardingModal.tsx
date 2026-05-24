import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AppLogo } from '@/components/AppLogo'
import { Anchor, Zap, TrendingUp } from 'lucide-react'

type SkillLevel = 'Iniciante' | 'Intermediário' | 'Avançado'

const LEVELS: { value: SkillLevel; icon: typeof Anchor; desc: string; sub: string }[] = [
  { value: 'Iniciante',     icon: Anchor,     desc: 'Prefiro ondas pequenas e calmas', sub: 'Até 0.8m · vento fraco' },
  { value: 'Intermediário', icon: TrendingUp, desc: 'Me viro bem em ondas médias',      sub: 'Até 1.5m · qualquer vento' },
  { value: 'Avançado',      icon: Zap,        desc: 'Quanto maior e mais forte, melhor', sub: 'Qualquer tamanho' },
]

interface Props {
  onDone: () => void
}

export function OnboardingModal({ onDone }: Props) {
  const [level, setLevel] = useState<SkillLevel | null>(null)

  const handleDone = (skip = false) => {
    try {
      if (!skip && level) localStorage.setItem('pref_skill', JSON.stringify(level))
      localStorage.setItem('onboarding_done', '1')
    } catch { /* modo privado */ }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 anim-slide pb-4">

        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <AppLogo size={64} variant="icon" />
          </div>
          <div>
            <h2 className="text-2xl font-black">Bem-vindo ao Surf AI!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Uma pergunta rápida para personalizar suas recomendações
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-3">
            Qual é o seu nível de surf?
          </p>
          {LEVELS.map(({ value, icon: Icon, desc, sub }) => (
            <button
              key={value}
              onClick={() => setLevel(value)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                level === value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/40 hover:bg-muted/20'
              }`}
            >
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                level === value ? 'bg-primary/20' : 'bg-muted/40'
              }`}>
                <Icon className={`h-5 w-5 ${level === value ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm">{value}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
                <div className="text-xs text-muted-foreground/60 mt-0.5">{sub}</div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                level === value ? 'border-primary bg-primary' : 'border-border'
              }`}>
                {level === value && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <Button
            className="w-full h-12 text-base font-bold"
            onClick={() => handleDone(false)}
            disabled={!level}
          >
            Começar a surfar
          </Button>
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
