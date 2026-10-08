import { Bell, Crown, History, MessageCircle, Scale, ShieldOff, Zap, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Reveal } from '@/components/landing/LandingComponents'
import { PushNotificationCard } from '@/components/PushNotificationCard'
import { ChatBubble } from '@/components/home/ChatBubble'
import { CompareSpotCard } from '@/components/spot/CompareSpotCard'
import { CompareTable } from '@/components/spot/CompareTable'
import type { Trend } from '@/lib/compareTrend'
import { DayCurveCard, type CurveDay } from '@/components/spot/DayCurveCard'
import { getRatingInfo } from '@/lib/rating'

// "O que muda no seu surf" da página Premium (08/out/2026, 3ª versão). Cada recurso aparece com
// a MESMA peça do app ("vamos usar o que o app já usa, que já é validado e é bonito"): o alerta
// da landing, o balão do chat, os cartões da tela Comparar e a linha do dia arrastável da
// previsão. Os números são de EXEMPLO (pedido dele: "que o usuário veja a diferença") e estão
// marcados assim. Formato igual ao do app: nota com ponto (7.6), vento com sigla e nome.

const Caption = ({ children }: { children: ReactNode }) => (
  <div className="text-[11px] text-muted-foreground">{children}</div>
)

function Score({ value }: { value: number }) {
  return <span style={{ color: getRatingInfo(value).scoreColor }}>{value.toFixed(1)}</span>
}

function AlertExample() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <PushNotificationCard
        time="sáb 6:12"
        title={<>A Joaquina está com <Score value={8.2} /></>}
        body="Onda de 1.4 a 1.7m, vento W oeste de 8km/h. Bora?"
      />
      <Caption>Exemplo</Caption>
    </div>
  )
}

function ChatExample() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-border/50 bg-background/60 p-3">
      <ChatBubble role="user">Amanhã vai entrar vento sul forte. Onde dá pra surfar de manhã?</ChatBubble>
      <ChatBubble role="assistant">
        Vai na Barra da Lagoa. Amanhã cedo ela fica com onda de 0.9 a 1.2m e 9 segundos, maré secando até as 9h.
        {' '}O vento S sul de 25km/h sopra de trás da praia e deixa o mar liso. Melhor horário: das 7h às 10h, nota 6.8.
        {' '}Nas praias do sul, com esse vento, nenhuma passa de 3.5.
      </ChatBubble>
      <Caption>Exemplo</Caption>
    </div>
  )
}

// Mesmo sábado de manhã nas três: a Mole pega a ondulação maior e o vento mais fraco
const COMPARE_EXAMPLE = [
  { id: 'mole', name: 'Praia Mole', region: 'Centro', score: 7.6, waveHeight: 1.4, swellPeriod: 11, windSpeed: 8, waterTemp: 20 },
  { id: 'joaquina', name: 'Joaquina', region: 'Centro', score: 5.4, waveHeight: 1.3, swellPeriod: 11, windSpeed: 17, waterTemp: 20 },
  { id: 'campeche', name: 'Campeche', region: 'Sul', score: 3.9, waveHeight: 0.9, swellPeriod: 9, windSpeed: 22, waterTemp: 20 },
]
const COMPARE_TRENDS: Record<string, Trend> = { mole: 'up', joaquina: 'stable', campeche: 'down' }

function CompareExample() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {COMPARE_EXAMPLE.map((s, i) => (
          <CompareSpotCard key={s.id} index={i} score={s.score} name={s.name} region={s.region} />
        ))}
      </div>
      <CompareTable spots={COMPARE_EXAMPLE} trends={COMPARE_TRENDS} />
      <Caption>Exemplo: sábado, 7h</Caption>
    </div>
  )
}

// Um sábado de exemplo hora a hora: manhã boa com vento oeste fraco, vento nordeste a partir das
// 10h derrubando a nota, maré enchendo de manhã
const CURVE_SCORES: Record<number, number> = {
  4: 5.2, 5: 6.1, 6: 7.3, 7: 7.8, 8: 7.6, 9: 7.0, 10: 5.8, 11: 4.9, 12: 4.3,
  13: 4.1, 14: 4.4, 15: 4.8, 16: 5.2, 17: 5.5, 18: 5.0, 19: 4.6, 20: 4.3,
}
const EXAMPLE_DAY: CurveDay = (() => {
  const hours = Object.entries(CURVE_SCORES).map(([h, score]) => {
    const hour = Number(h)
    const morning = hour < 10
    return {
      hour,
      score,
      waveHeight: 1.2,
      windSpeed: morning ? 6 + Math.max(0, hour - 5) : 18 + Math.min(6, hour - 10),
      windDirection: morning ? 'W' : 'NE',
      swellPeriod: 11,
    }
  })
  const best = hours.reduce((a, b) => (b.score > a.score ? b : a))
  const tideHeights = Array.from({ length: 25 }, (_, h) => 0.5 + 0.35 * Math.sin((2 * Math.PI * (h - 6)) / 12.4))
  return { hours, best, sunriseHour: 6, sunsetHour: 18, tideHeights }
})()

function BestWindowExample() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <DayCurveCard data={EXAMPLE_DAY} caption="Joaquina · sábado" />
      </div>
      <Caption>Exemplo</Caption>
    </div>
  )
}

const FEATURES: { icon: LucideIcon; title: string; text: string; visual: ReactNode }[] = [
  {
    icon: Bell,
    title: 'O celular avisa quando o mar fica bom',
    text: 'Você escolhe a nota que te tira da cama em cada praia. No exemplo, quem recebeu o alerta às 6h pegou 8.2. Às 10h o vento virou e a nota caiu pra 4.3.',
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
    text: 'Mesma ondulação, notas bem diferentes. No exemplo, a Mole tem a onda maior e o vento mais fraco: 7.6 contra 3.9 no Campeche.',
    visual: <CompareExample />,
  },
  {
    icon: Zap,
    title: 'O melhor horário do dia',
    text: 'A nota hora a hora mostra a janela boa. Arraste pela curva: às 7h a nota é 7.8, à 1 da tarde cai pra 4.1.',
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
