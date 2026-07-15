import { ArrowLeft, Waves, Wind, Droplets, Calendar, Lock, Sparkles, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { analyzeConditions, BeachCondition } from '@/lib/surfData'
import { getRatingInfo } from '@/lib/rating'

interface Props {
  spot: BeachCondition
  onBack: () => void
  onLogin: () => void
}

// Versão pública (sem login) dos picos teaser: mostra o score e a análise reais —
// gera confiança e serve de conteúdo indexável — mas borra a previsão detalhada,
// que fica atrás do CTA de cadastro. O bloco borrado é decorativo (não renderiza
// dado real de premium), então não há nada sensível pra vazar via inspeção do DOM.
export function SpotTeaser({ spot, onBack, onLogin }: Props) {
  const rating = getRatingInfo(spot.score)

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-2.5 max-w-4xl">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8 px-2">
            <ArrowLeft className="h-4 w-4 mr-1" />Voltar
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 pb-24 max-w-4xl space-y-5">
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold leading-tight">{spot.name}</h1>
              <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full mt-1.5 inline-block">
                {spot.region} da Ilha
              </span>
            </div>
            <div className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl border border-border/50 bg-background p-3 min-w-[90px]">
              <div className={`text-4xl font-bold leading-none ${rating.color}`}>{Number(spot.score).toFixed(1)}</div>
              <div className={`text-xs font-bold mt-1 ${rating.color}`}>{rating.label}</div>
              <div className="flex gap-0.5 mt-1.5">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className={`h-1.5 w-4 rounded-full ${i <= rating.bars ? rating.bg : 'bg-muted'}`} />
                ))}
              </div>
              <div className="text-xs text-muted-foreground/50 mt-1.5">Score IA</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="flex flex-col items-center gap-1 bg-muted/20 rounded-xl p-2.5">
              <Waves className="h-4 w-4 text-primary" />
              <div className="text-base font-bold">{spot.waveHeight.toFixed(1)}m</div>
              <div className="text-xs text-muted-foreground text-center">Ondas</div>
            </div>
            <div className="flex flex-col items-center gap-1 bg-muted/20 rounded-xl p-2.5">
              <Wind className="h-4 w-4 text-accent" />
              <div className="text-base font-bold">{Math.round(spot.windSpeed)}</div>
              <div className="text-xs text-muted-foreground text-center">km/h</div>
            </div>
            <div className="flex flex-col items-center gap-1 bg-muted/20 rounded-xl p-2.5">
              <Droplets className="h-4 w-4 text-cyan-500" />
              <div className="text-base font-bold">{spot.waterConditions.temperature}°</div>
              <div className="text-xs text-muted-foreground text-center">Água</div>
            </div>
            <div className="flex flex-col items-center gap-1 bg-muted/20 rounded-xl p-2.5">
              <Calendar className="h-4 w-4 text-rating-fair" />
              <div className="text-base font-bold">{Math.round(spot.swellPeriod)}s</div>
              <div className="text-xs text-muted-foreground text-center">Período</div>
            </div>
          </div>
        </div>

        <Alert className="bg-primary/5 border-primary/20">
          <TrendingUp className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary text-sm">Análise Inteligente</AlertTitle>
          <AlertDescription className="text-foreground text-sm">{analyzeConditions(spot)}</AlertDescription>
        </Alert>

        <div className="relative overflow-hidden rounded-2xl border border-border/50">
          <div className="blur-sm select-none pointer-events-none p-4 space-y-3" aria-hidden>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map(i => <div key={i} className="rounded-xl bg-muted/40 h-24" />)}
            </div>
            <div className="rounded-xl bg-muted/40 h-32" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 p-6">
            <div className="text-center space-y-3 max-w-xs">
              <Lock className="h-6 w-6 mx-auto text-primary" />
              <p className="text-sm font-semibold">
                Veja a previsão dos próximos dias, a maré e a melhor hora pra pegar onda no {spot.name}
              </p>
              <Button className="w-full" onClick={onLogin}>
                <Sparkles className="h-4 w-4 mr-1.5" />Criar conta grátis
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
