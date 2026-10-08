import { Bell, CalendarDays, Crown, History, MessageCircle, Scale, ShieldOff, Zap, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { PushMock, CompareMock } from '@/components/landing/PremiumMorning'
import { Reveal } from '@/components/landing/LandingComponents'
import { useReveal } from '@/hooks/use-reveal'
import { useSurfData } from '@/contexts/SurfDataContext'
import { getRatingInfo } from '@/lib/rating'
import { formatWaveRange, type BeachCondition } from '@/lib/surfData'
import { withArticle } from '@/lib/beachArticles'
import { todaySP } from '@/lib/timeSP'
import { FREE_DAYS as FREE_FORECAST_DAYS } from '@/lib/weatherData'

// "O que muda no seu surf" da página Premium (08/out/2026). Substituiu a lista de 7 benefícios
// que vinha dentro do card de preço (e repetia a tabela Free vs Premium logo abaixo): cada
// recurso principal aparece funcionando, com o mar de agora (useSurfData), igual à landing.
// Nada aqui é inventado: o alerta e a comparação são as mesmas peças ao vivo da landing
// (PremiumMorning.tsx), a faixa de dias usa as datas reais e o chat monta a resposta com a
// nota de agora, avisando que é um exemplo.

const PREMIUM_DAYS = 14
const WEEKDAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function DayStrip() {
  const { ref, visible } = useReveal(0.4)
  const base = new Date(`${todaySP()}T12:00:00`)
  const days = Array.from({ length: PREMIUM_DAYS }, (_, i) => new Date(base.getTime() + i * 86_400_000))
  return (
    <div ref={ref} className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/90 p-3.5">
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d, i) => {
          const free = i < FREE_FORECAST_DAYS
          return (
            <div key={i}
              className={`flex flex-col items-center rounded-lg py-1.5 text-center leading-tight ${free
                ? 'bg-muted/70 text-muted-foreground'
                : 'border border-primary/40 bg-primary/15 text-foreground'}`}
              style={!free && visible ? { animation: `dayLight 0.45s ease-out ${0.15 + (i - FREE_FORECAST_DAYS) * 0.07}s both` } : !free ? { opacity: 0.2 } : undefined}>
              <span className="text-[9px] uppercase tracking-wide opacity-70">{i === 0 ? 'hoje' : WEEKDAY[d.getDay()]}</span>
              <span className="text-sm font-bold tabular-nums">{d.getDate()}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Grátis: {FREE_FORECAST_DAYS} dias</span>
        <span className="font-semibold text-primary">Premium: {PREMIUM_DAYS} dias</span>
      </div>
    </div>
  )
}

// Melhor praia de cada ponta da ilha agora, no tom do chat (sem travessão, frases curtas)
function ChatMini() {
  const { conditions } = useSurfData()
  const best = (region: BeachCondition['region']) =>
    conditions.filter(c => c.region === region).sort((a, b) => b.score - a.score)[0]
  const north = best('Norte')
  const south = best('Sul')
  if (!north || !south) return <div className="h-32 w-full max-w-sm animate-pulse rounded-2xl bg-muted" />

  const score = (c: BeachCondition) => (
    <span className="font-bold" style={{ color: getRatingInfo(c.score).scoreColor }}>{c.score.toFixed(1)}</span>
  )
  const wave = (c: BeachCondition) => formatWaveRange(c.waveHeight).replace('–', ' a ')
  const diff = north.score - south.score
  const verdict = Math.abs(diff) < 0.3 ? 'Os dois lados estão parecidos agora.' : diff > 0 ? 'Agora o norte está melhor.' : 'Agora o sul está melhor.'

  return (
    <div className="flex w-full max-w-sm flex-col gap-2 rounded-2xl border border-border/60 bg-card/90 p-3.5 text-sm">
      <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-primary-foreground">
        Norte ou sul agora?
      </div>
      <div className="mr-auto max-w-[90%] rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 leading-relaxed">
        No norte, {withArticle(north.id, north.name)} está com nota {score(north)} e onda de {wave(north)}.
        {' '}No sul, {withArticle(south.id, south.name)} está com {score(south)} e onda de {wave(south)}.
        {' '}{verdict}
      </div>
      <div className="text-[11px] text-muted-foreground">Exemplo com o mar de agora</div>
    </div>
  )
}

const FEATURES: { icon: LucideIcon; title: string; text: string; visual: ReactNode }[] = [
  {
    icon: Bell,
    title: 'O celular avisa quando o mar fica bom',
    text: 'Você escolhe a nota que te tira da cama em cada praia. Chega de descobrir às 10h que a manhã estava clássica.',
    visual: <PushMock />,
  },
  {
    icon: CalendarDays,
    title: '14 dias de previsão, não 3',
    text: 'Planeje esta semana e a próxima, praia por praia.',
    visual: <DayStrip />,
  },
  {
    icon: MessageCircle,
    title: 'Pergunte pro Surf AI',
    text: 'Onde e quando surfar, em português de surfista, com a previsão real das 14 praias.',
    visual: <ChatMini />,
  },
  {
    icon: Scale,
    title: 'Praias lado a lado',
    text: 'Até 3 praias na mesma tela, com nota, onda e vento, pra decidir antes de sair de casa.',
    visual: <CompareMock />,
  },
]

const EXTRAS: { icon: LucideIcon; label: string }[] = [
  { icon: Zap, label: 'Melhor horário do dia' },
  { icon: History, label: 'Histórico de 30 dias' },
  { icon: ShieldOff, label: 'Sem anúncios' },
  { icon: Crown, label: 'Selo Premium no perfil' },
]

export function PremiumShowcase({ title }: { title: string }) {
  return (
    <section className="space-y-8">
      <h2 className="text-center text-2xl font-black text-balance">{title}</h2>
      {FEATURES.map((f, i) => (
        <Reveal key={f.title} delay={i === 0 ? 0 : 0.05}>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <f.icon className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base font-bold leading-snug">{f.title}</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              </div>
            </div>
            <div className="flex justify-center">{f.visual}</div>
          </div>
        </Reveal>
      ))}
      <Reveal>
        <div className="grid grid-cols-2 gap-2">
          {EXTRAS.map(e => (
            <div key={e.label} className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-2.5 text-xs font-medium">
              <e.icon className="h-4 w-4 shrink-0 text-rating-fair" />{e.label}
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  )
}
