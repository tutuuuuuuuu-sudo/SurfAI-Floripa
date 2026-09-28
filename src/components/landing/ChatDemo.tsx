import { useEffect, useMemo, useRef, useState } from 'react'
import { Crown, Sparkles } from 'lucide-react'
import { useSurfData } from '@/contexts/SurfDataContext'
import { getRatingInfo } from '@/lib/rating'
import { formatWaveRange, type BeachCondition } from '@/lib/surfData'
import { directionName } from '@/lib/directions'

// "Pergunta pro Surf AI" (landing v2, 28/set/2026): conversa de exemplo no MESMO tom do chat
// real (prioridade onda → maré → vento → horário, sem travessão, 2-4 frases — ver prompt em
// api/surf-chat.ts). As respostas são montadas aqui com o dado real de agora, sem chamar a IA
// (a cota do Gemini é pequena e o visitante nem tem conta) — por isso a legenda diz que é um
// exemplo. Substituiu o ChatPreviewMockup antigo, com resposta fixa e travessão.

// Artigo de cada praia ("o Campeche", "a Joaquina", "os Açores") — sem isso as frases saíam
// "eu iria na Novo Campeche". Naufragados se fala sem artigo ("em Naufragados").
const ARTICLE: Record<string, 'o' | 'a' | 'os' | ''> = {
  campeche: 'o', 'novo-campeche': 'o', 'morro-pedras': 'o', matadeiro: 'o', mocambique: 'o', santinho: 'o',
  joaquina: 'a', mole: 'a', 'barra-lagoa': 'a', armacao: 'a', 'lagoinha-leste': 'a', solidao: 'a',
  acores: 'os', naufragados: '',
}
const IN: Record<string, string> = { o: 'no', a: 'na', os: 'nos', '': 'em' }
const withArt = (b: BeachCondition) => { const a = ARTICLE[b.id] ?? ''; return a ? `${a} ${b.name}` : b.name }
const inArt = (b: BeachCondition) => `${IN[ARTICLE[b.id] ?? '']} ${b.name}`

// Faixa de onda escrita como o chat real escreve ("0.8 a 1.0m", sem traço)
const wave = (h: number) => formatWaveRange(h).replace('–', ' a ')
const wind = (b: BeachCondition) => `vento ${b.windDirection} ${directionName(b.windDirection)} de ${Math.round(b.windSpeed)}km/h`
const GOOD_BARS = getRatingInfo(5.5).bars

function verdict(b: BeachCondition) {
  const bars = getRatingInfo(b.score).bars
  if (bars >= 4) return 'vale muito a pena cair'
  if (bars >= GOOD_BARS) return 'dá pra surfar de boa'
  if (bars >= 2) return 'tá meio fraco, só se for perto de você'
  return 'hoje não compensa'
}

interface QA { q: string; a: (spots: BeachCondition[]) => string }

const QUESTIONS: QA[] = [
  {
    q: 'Qual a melhor praia agora?',
    a: spots => {
      const [first, second] = [...spots].sort((a, b) => b.score - a.score)
      const alt = second && getRatingInfo(second.score).bars >= GOOD_BARS
        ? ` Outra opção boa é ${withArt(second)}, com ${second.score.toFixed(1)}.` : ''
      return `Agora é ${withArt(first)}, nota ${first.score.toFixed(1)}. Tá com onda de ${wave(first.waveHeight)}, maré ${first.tide.toLowerCase()} e ${wind(first)}.${alt}`
    },
  },
  {
    q: 'Como tá o Campeche?',
    a: spots => {
      const c = spots.find(s => s.id === 'campeche')
      if (!c) return 'Agora não consegui ler o Campeche, tenta de novo daqui a pouco.'
      return `O Campeche tá com onda de ${wave(c.waveHeight)}, maré ${c.tide.toLowerCase()} e ${wind(c)}. Nota ${c.score.toFixed(1)}, ${verdict(c)}.`
    },
  },
  {
    q: 'Tem praia boa pra iniciante?',
    a: spots => {
      const easy = spots
        .filter(s => getRatingInfo(s.score).bars >= GOOD_BARS && s.waveHeight <= 1.0 && s.windSpeed <= 15)
        .sort((a, b) => b.score - a.score)[0]
      if (easy) {
        return `Pra começar eu iria ${inArt(easy)}: onda de ${wave(easy.waveHeight)}, mais tranquila, maré ${easy.tide.toLowerCase()} e ${wind(easy)}. Nota ${easy.score.toFixed(1)}. Fica no raso e aproveita.`
      }
      const smallest = [...spots].sort((a, b) => a.waveHeight - b.waveHeight)[0]
      return `Hoje tá puxado pra iniciante: onde o mar tá bom, a onda passa de 1m ou o vento tá forte. A menor onda agora tá ${inArt(smallest)}, com ${wave(smallest.waveHeight)}. Se for, vai com alguém junto.`
    },
  },
]

export function ChatDemo() {
  const { conditions } = useSurfData()
  const [active, setActive] = useState(0)
  const [typing, setTyping] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const answer = useMemo(
    () => (conditions.length > 0 ? QUESTIONS[active].a(conditions) : null),
    [active, conditions]
  )

  const ask = (i: number) => {
    if (i === active && !typing) return
    setActive(i)
    setTyping(true)
    if (timer.current) clearTimeout(timer.current)
    // "digitando..." curtinho; sem animação pra quem pediu menos movimento
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    timer.current = setTimeout(() => setTyping(false), reduce ? 0 : 900)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15">
            <Sparkles className="h-4 w-4 text-primary" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold">Surf AI</div>
            <div className="text-[11px] text-muted-foreground">exemplo com o mar de agora</div>
          </div>
        </div>

        <div className="flex justify-end" key={`q${active}`} style={{ animation: 'fadeIn 0.25s ease-out' }}>
          <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground">
            {QUESTIONS[active].q}
          </div>
        </div>

        <div className="flex min-h-[4.5rem] justify-start">
          {typing || !answer ? (
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border/60 bg-background px-4 py-3" aria-label="Surf AI digitando">
              {[0, 1, 2].map(i => (
                <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          ) : (
            <div key={`a${active}`} className="max-w-[90%] rounded-2xl rounded-bl-sm border border-border/60 bg-background px-3.5 py-2.5 text-sm leading-relaxed"
              style={{ animation: 'fadeIn 0.3s ease-out' }}>
              {answer}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Perguntas de exemplo">
        {QUESTIONS.map((qa, i) => (
          <button
            key={qa.q}
            type="button"
            onClick={() => ask(i)}
            aria-pressed={i === active}
            className={`rounded-full border px-3.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              i === active ? 'border-primary text-primary' : 'border-border text-foreground hover:border-primary/50'
            }`}
          >
            {qa.q}
          </button>
        ))}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Crown className="h-3.5 w-3.5 text-rating-fair" />
        No Premium você pergunta o que quiser sobre as 14 praias e a semana inteira, até 20 perguntas por dia.
      </p>
    </div>
  )
}
