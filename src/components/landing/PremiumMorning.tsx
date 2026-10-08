import { Bell, Compass, Scale } from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'
import { GeoFinderMockup, Reveal } from '@/components/landing/LandingComponents'
import { useSurfData } from '@/contexts/SurfDataContext'
import { getRatingInfo } from '@/lib/rating'
import { formatWaveRange } from '@/lib/surfData'
import { directionName } from '@/lib/directions'
import { withArticle } from '@/lib/beachArticles'

// "E ainda tem mais" contado como uma manhã de surf com o Premium (29/set/2026). O usuário
// achou os 3 cards coloridos anteriores genéricos, "com cara de IA": aqui a estrutura é uma
// linha do tempo porque a ordem é real (o alerta chega, você sai de casa, decide a praia), e
// cada passo mostra um pedaço do app com o dado de agora, sem card colorido de enfeite.

const STEPS_BASE = [
  { time: '05:40', icon: Bell, title: 'O mar ficou bom. Você fica sabendo primeiro.', text: 'Escolha a nota que te tira da cama em cada praia. Quando o mar chega lá, o celular vibra. Chega de descobrir às 10h que a manhã estava clássica.' },
  { time: '06:05', icon: Compass, title: 'Na porta de casa: vou na mais perto ou na melhor?', text: 'O Bora Surfar compara a praia mais perto de você com a melhor da região e responde na hora se vale rodar mais uns quilômetros.' },
  { time: '06:10', icon: Scale, title: 'Ainda em dúvida? Coloca lado a lado.', text: 'Até 3 praias na mesma tela, com nota, onda e vento. E ainda dá pra ver se o mar de hoje está acima da média do mês.' },
]

function PushMock() {
  const { conditions } = useSurfData()
  const best = [...conditions].sort((a, b) => b.score - a.score)[0]
  return (
    <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/90 p-3.5 shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <AppLogo size={18} variant="icon" />
        <span className="font-semibold uppercase tracking-wide">Surf AI</span>
        <span className="ml-auto">agora</span>
      </div>
      {best ? (
        <>
          <div className="mt-1.5 text-sm font-bold">
            {(() => { const n = withArticle(best.id, best.name); return n.charAt(0).toUpperCase() + n.slice(1) })()} está com{' '}
            <span style={{ color: getRatingInfo(best.score).scoreColor }}>{best.score.toFixed(1)}</span>
          </div>
          <div className="text-sm leading-snug text-muted-foreground">
            Onda de {formatWaveRange(best.waveHeight).replace('–', ' a ')}, vento {best.windDirection} {directionName(best.windDirection)} de {Math.round(best.windSpeed)}km/h. Bora?
          </div>
        </>
      ) : (
        <div className="mt-2 h-10 animate-pulse rounded bg-muted" />
      )}
    </div>
  )
}

function CompareMock() {
  const { conditions } = useSurfData()
  const picks = ['joaquina', 'mole', 'campeche']
    .map(id => conditions.find(c => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c)
  if (picks.length === 0) return <div className="h-24 w-full max-w-sm animate-pulse rounded-2xl bg-muted" />
  return (
    <div className="flex w-full max-w-sm flex-col gap-2.5 rounded-2xl border border-border/60 bg-card/90 p-4">
      {picks.map(c => {
        const info = getRatingInfo(c.score)
        return (
          <div key={c.id} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-sm">
            <span className="truncate font-medium">{c.name}</span>
            <span className="h-2 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full transition-all duration-700" style={{ width: `${c.score * 10}%`, background: info.scoreColor }} />
            </span>
            <span className="text-right font-bold tabular-nums" style={{ color: info.scoreColor }}>{c.score.toFixed(1)}</span>
          </div>
        )
      })}
      <div className="text-[11px] text-muted-foreground">nota de agora</div>
    </div>
  )
}

const VISUALS = [<PushMock key="push" />, <div key="geo" className="w-full max-w-sm"><GeoFinderMockup /></div>, <CompareMock key="cmp" />]

export function PremiumMorning() {
  return (
    <ol className="relative mx-auto flex max-w-3xl flex-col gap-12">
      {/* linha do tempo */}
      <span className="absolute left-[19px] top-2 bottom-2 w-px bg-border md:left-1/2" aria-hidden="true" />
      {STEPS_BASE.map((step, i) => (
        <li key={step.time}>
          <Reveal delay={i * 0.1}>
            <div className={`relative grid gap-5 pl-14 md:grid-cols-2 md:items-center md:gap-12 md:pl-0 ${i % 2 === 1 ? 'md:[&>*:first-child]:order-2' : ''}`}>
              {/* marcador na linha */}
              <span className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-background text-primary md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2">
                <step.icon className="h-4 w-4" />
              </span>
              <div className={i % 2 === 1 ? 'md:pl-10' : 'md:pr-10 md:text-right'}>
                <div className="text-xs font-semibold tabular-nums tracking-wider text-primary">{step.time}</div>
                <h3 className="mt-1 text-xl font-black">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/70">{step.text}</p>
              </div>
              <div className={`flex ${i % 2 === 1 ? 'md:justify-end md:pr-10' : 'md:pl-10'}`}>{VISUALS[i]}</div>
            </div>
          </Reveal>
        </li>
      ))}
    </ol>
  )
}
