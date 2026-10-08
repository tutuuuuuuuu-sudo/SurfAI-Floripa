import { Bell, Crown, History, MessageCircle, Scale, ShieldOff, Zap, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Reveal } from '@/components/landing/LandingComponents'
import { AppLogo } from '@/components/AppLogo'
import { getRatingInfo } from '@/lib/rating'

// "O que muda no seu surf" da página Premium (08/out/2026, 2ª versão). A 1ª usava o mar de agora
// e o usuário pediu exemplos com números "que o usuário veja a diferença e sinta que isso é
// necessário pra ele" (e achou "Norte ou sul agora?" genérico demais). Cada recurso mostra uma
// situação concreta de Floripa com o antes/depois em nota. Tudo marcado como exemplo.
// Formato igual ao do app: nota com ponto (7.6), onda "1.4 a 1.7m", vento com sigla e nome.

function Score({ value }: { value: number }) {
  return <span className="font-bold tabular-nums" style={{ color: getRatingInfo(value).scoreColor }}>{value.toFixed(1)}</span>
}

const Caption = ({ children }: { children: ReactNode }) => (
  <div className="text-[11px] text-muted-foreground">{children}</div>
)

function AlertExample() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <div className="rounded-2xl border border-border/60 bg-card/90 p-3.5 shadow-xl">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <AppLogo size={18} variant="icon" />
          <span className="font-semibold uppercase tracking-wide">Surf AI</span>
          <span className="ml-auto">sáb 6:12</span>
        </div>
        <div className="mt-1.5 text-sm font-bold">A Joaquina está com <Score value={8.2} /></div>
        <div className="text-sm leading-snug text-muted-foreground">Onda de 1.4 a 1.7m, vento W oeste de 8km/h. Bora?</div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-border/60 bg-card/60 p-2.5">
          <div className="text-muted-foreground">6h, com o alerta</div>
          <div className="mt-0.5 text-lg leading-none"><Score value={8.2} /></div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/60 p-2.5">
          <div className="text-muted-foreground">10h, o vento virou</div>
          <div className="mt-0.5 text-lg leading-none"><Score value={4.3} /></div>
        </div>
      </div>
      <Caption>Exemplo</Caption>
    </div>
  )
}

function ChatExample() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2 rounded-2xl border border-border/60 bg-card/90 p-3.5 text-sm">
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-primary-foreground">
        Amanhã vai entrar vento sul forte. Onde dá pra surfar de manhã?
      </div>
      <div className="mr-auto max-w-[92%] rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 leading-relaxed">
        Vai na Barra da Lagoa. Amanhã cedo ela fica com onda de 0.9 a 1.2m e 9 segundos, maré secando até as 9h.
        {' '}O vento S sul de 25km/h sopra de trás da praia e deixa o mar liso. Melhor horário: das 7h às 10h, nota <Score value={6.8} />.
        {' '}Nas praias do sul, com esse vento, nenhuma passa de <Score value={3.5} />.
      </div>
      <Caption>Exemplo</Caption>
    </div>
  )
}

const COMPARE = [
  { name: 'Praia Mole', score: 7.6 },
  { name: 'Joaquina', score: 5.4 },
  { name: 'Campeche', score: 3.9 },
]

function CompareExample() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2.5 rounded-2xl border border-border/60 bg-card/90 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sábado, 7h</div>
      {COMPARE.map(c => (
        <div key={c.name} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-sm">
          <span className="truncate font-medium">{c.name}</span>
          <span className="h-2 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full" style={{ width: `${c.score * 10}%`, background: getRatingInfo(c.score).scoreColor }} />
          </span>
          <span className="text-right"><Score value={c.score} /></span>
        </div>
      ))}
      <Caption>Exemplo</Caption>
    </div>
  )
}

// Nota hora a hora de um dia de exemplo, das 5h às 19h: manhã boa, vento entrando ao meio-dia
const HOURS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
const HOURLY = [5.9, 7.3, 7.8, 7.6, 7.0, 5.7, 4.9, 4.3, 4.1, 4.4, 4.8, 5.2, 5.5, 5.0, 4.3]
const WINDOW = { from: 6, to: 9 }

function BestWindowExample() {
  const W = 320, H = 110, padX = 8, top = 14, bottom = 24
  const x = (h: number) => padX + ((h - HOURS[0]) / (HOURS[HOURS.length - 1] - HOURS[0])) * (W - padX * 2)
  const y = (s: number) => top + (1 - s / 10) * (H - top - bottom)
  const line = HOURS.map((h, i) => `${i ? 'L' : 'M'}${x(h).toFixed(1)},${y(HOURLY[i]).toFixed(1)}`).join(' ')
  const area = `${line} L${x(HOURS[HOURS.length - 1]).toFixed(1)},${H - bottom} L${x(HOURS[0]).toFixed(1)},${H - bottom} Z`
  const best = HOURLY.indexOf(Math.max(...HOURLY))
  return (
    <div className="flex w-full max-w-sm flex-col gap-2 rounded-2xl border border-border/60 bg-card/90 p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Nota hora a hora de um dia de exemplo, melhor das 6h às 9h">
        <rect x={x(WINDOW.from)} y={top - 6} width={x(WINDOW.to) - x(WINDOW.from)} height={H - top - bottom + 6} rx="6" fill="var(--primary)" opacity="0.14" />
        <path d={area} fill="var(--primary)" opacity="0.08" />
        <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(HOURS[best])} cy={y(HOURLY[best])} r="4.5" fill={getRatingInfo(HOURLY[best]).scoreColor} stroke="var(--card)" strokeWidth="2" />
        {[6, 9, 12, 15, 18].map(h => (
          <text key={h} x={x(h)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{h}h</text>
        ))}
      </svg>
      <div className="flex items-center justify-between text-xs">
        <span>Das {WINDOW.from}h às {WINDOW.to}h: nota <Score value={HOURLY[best]} /></span>
        <span className="text-muted-foreground">13h: <Score value={4.1} /></span>
      </div>
      <Caption>Exemplo</Caption>
    </div>
  )
}

const FEATURES: { icon: LucideIcon; title: string; text: string; visual: ReactNode }[] = [
  {
    icon: Bell,
    title: 'O celular avisa quando o mar fica bom',
    text: 'Você escolhe a nota que te tira da cama em cada praia. No exemplo, quem recebeu o alerta às 6h pegou 8.2. Quem abriu o app às 10h pegou 4.3.',
    visual: <AlertExample />,
  },
  {
    icon: MessageCircle,
    title: 'Pergunte pro Surf AI',
    text: 'Ele conhece cada praia da ilha e responde com a previsão de verdade, em português de surfista.',
    visual: <ChatExample />,
  },
  {
    icon: Scale,
    title: 'Praias lado a lado',
    text: 'Mesma ondulação, notas bem diferentes. Escolher a praia certa vale mais que acordar cedo.',
    visual: <CompareExample />,
  },
  {
    icon: Zap,
    title: 'O melhor horário do dia',
    text: 'A nota hora a hora mostra a janela boa. Fora dela, o mesmo mar vale quase a metade.',
    visual: <BestWindowExample />,
  },
]

const EXTRAS: { icon: LucideIcon; label: string }[] = [
  { icon: History, label: 'Histórico de 30 dias' },
  { icon: ShieldOff, label: 'Sem anúncios' },
  { icon: Crown, label: 'Selo Premium' },
]

export function PremiumShowcase({ title }: { title: string }) {
  return (
    <section className="space-y-9">
      <h2 className="text-center text-2xl font-black text-balance">{title}</h2>
      {FEATURES.map(f => (
        <Reveal key={f.title}>
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
        <div className="grid grid-cols-3 gap-2">
          {EXTRAS.map(e => (
            <div key={e.label} className="flex flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-card/60 px-2 py-3 text-center text-[11px] font-medium leading-tight">
              <e.icon className="h-4 w-4 text-rating-fair" />{e.label}
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  )
}
