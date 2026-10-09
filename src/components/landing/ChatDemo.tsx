import { useEffect, useMemo, useRef, useState } from 'react'
import { Crown, Sparkles } from 'lucide-react'
import { useSurfData } from '@/contexts/SurfDataContext'
import { getRatingInfo } from '@/lib/rating'
import { formatWaveRange, getBeachPeaks, type BeachCondition } from '@/lib/surfData'
import { directionName } from '@/lib/directions'
import { withArticle } from '@/lib/beachArticles'
import { todaySP } from '@/lib/timeSP'
import { computeGoldenWindow } from '../../../api/_goldenWindow'

// "Pergunta pro Surf AI" (landing v2, 28/set/2026): conversa de exemplo no MESMO tom do chat
// real (prioridade onda → maré → vento → horário, sem travessão, 2-4 frases — ver prompt em
// api/surf-chat.ts). As respostas são montadas aqui com o dado real de agora, sem chamar a IA
// (a cota do Gemini é pequena e o visitante nem tem conta) — por isso a legenda diz que é um
// exemplo. Substituiu o ChatPreviewMockup antigo, com resposta fixa e travessão.
// Perguntas trocadas a pedido do usuário (29/set/2026): a 2ª compara dois picos de praias
// diferentes ("Lomba ou Caldeirão?", usando o casamento de swell de cada pico, o mesmo de
// PicosSection) e a 3ª fala do fim de semana no sul da ilha com a previsão real
// (api/landing-day.ts só libera praias abertas; no Sul são Campeche e Matadeiro).

const withArt = (b: BeachCondition) => withArticle(b.id, b.name)

// Faixa de onda escrita como o chat real escreve ("0.8 a 1.0m", sem traço)
const wave = (h: number) => formatWaveRange(h).replace('–', ' a ')
const wind = (b: BeachCondition) => `vento ${b.windDirection} ${directionName(b.windDirection)} de ${Math.round(b.windSpeed)}km/h`
const GOOD_BARS = getRatingInfo(5.5).bars

interface FutureDay {
  date: string
  hours: { hour: number; score: number; waveHeight: number; windSpeed: number; windDirection: string; swellPeriod: number }[]
  best: { hour: number; score: number; waveHeight: number; windSpeed: number; windDirection: string }
  sunriseHour: number | null
  sunsetHour: number | null
  tideHeights: number[] | null
}
type Weekend = { day: 'sábado' | 'domingo'; beach: 'Campeche' | 'Matadeiro'; data: FutureDay }[]

// Próximo sábado e domingo que caem de 1 a 7 dias à frente (o limite do landing-day)
const WEEKEND_DAYS = (() => {
  const base = new Date(`${todaySP()}T12:00:00`)
  const out: { offset: number; day: 'sábado' | 'domingo' }[] = []
  for (let d = 1; d <= 7; d++) {
    const w = new Date(base.getTime() + d * 86_400_000).getDay()
    if (w === 6 && !out.some(o => o.day === 'sábado')) out.push({ offset: d, day: 'sábado' })
    if (w === 0 && !out.some(o => o.day === 'domingo')) out.push({ offset: d, day: 'domingo' })
  }
  return out.sort((x, y) => x.offset - y.offset)
})()
const SOUTH = [{ id: 'campeche', name: 'Campeche' as const }, { id: 'matadeiro', name: 'Matadeiro' as const }]
const fmtH = (h: number) => `${h}h`

function summarize(d: FutureDay) {
  const sunrise = d.sunriseHour ?? 6, sunset = d.sunsetHour ?? 18
  const daylight = d.hours.filter(h => h.hour >= sunrise && h.hour <= sunset)
  const waves = (daylight.length ? daylight : d.hours).map(h => h.waveHeight)
  const gw = computeGoldenWindow(d.hours.map(h => ({ ...h, label: fmtH(h.hour) })), d.best.hour, sunrise, sunset)
  return {
    range: `${Math.min(...waves).toFixed(1)} a ${Math.max(...waves).toFixed(1)}m`,
    when: gw && gw.endHour > gw.startHour ? `das ${fmtH(gw.startHour)} às ${fmtH(gw.endHour)}` : `por volta das ${fmtH(d.best.hour)}`,
    score: d.best.score,
    wind: `${d.best.windDirection} ${directionName(d.best.windDirection)} de ${Math.round(d.best.windSpeed)}km/h`,
  }
}

function weekendAnswer(w: Weekend): string | null {
  if (w.length === 0) return null
  const best = [...w].sort((a, b) => b.data.best.score - a.data.best.score)[0]
  const b = summarize(best.data)
  const others = w.filter(x => x !== best).map(x => `${x.beach} no ${x.day}, ${summarize(x.data).score.toFixed(1)}`)
  const info = getRatingInfo(best.data.best.score)
  const close = info.bars >= 4 ? 'Vale separar a manhã.' : info.bars >= GOOD_BARS ? 'Dá pra planejar.' : 'Por enquanto o sul não promete muito, vale olhar de novo mais perto do dia.'
  return `No fim de semana o melhor do sul deve ser ${best.beach === 'Campeche' ? 'o Campeche' : 'o Matadeiro'} no ${best.day}: onda de ${b.range}, melhor ${b.when}, nota ${b.score.toFixed(1)}, com vento ${b.wind}. ${others.length ? `Pra comparar: ${others.join('; ')}. ` : ''}${close}`
}

// Casamento de swell de um pico (mesma conta de PicosSection)
function picoRead(beach: BeachCondition | undefined, picoId: string) {
  const m = beach ? getBeachPeaks(beach).find(s => s.id === picoId) : undefined
  if (!beach || !m) return null
  return { beach, m, mid: (Number(m.waveMin) + Number(m.waveMax)) / 2 }
}

interface QA { q: string; a: (spots: BeachCondition[], weekend: Weekend | null) => string | null }

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
    q: 'Tá melhor eu ir pra Lomba ou pro Caldeirão agora?',
    a: spots => {
      const lomba = picoRead(spots.find(s => s.id === 'campeche'), 'lomba-sabao')
      const cald = picoRead(spots.find(s => s.id === 'armacao'), 'caldeirao')
      if (!lomba || !cald) return null
      // Melhor casamento de swell primeiro; empate decide pela nota da praia e depois pelo tamanho
      const [win, lose] = [lomba, cald].sort((a, b) => a.m.minDiff - b.m.minDiff || b.beach.score - a.beach.score || b.mid - a.mid)
      const nameOf = (x: typeof win) => (x === lomba ? 'Lomba' : 'Caldeirão')
      const goTo = win === lomba ? 'pra Lomba' : 'pro Caldeirão'
      const art = lose === lomba ? 'A' : 'O'
      const swell = `${win.beach.swellDirection} ${directionName(win.beach.swellDirection)}`
      // Quando o pico escolhido tem onda menor, explicar o motivo (o swell entra melhor nele)
      const loseLine = lose.mid > win.mid
        ? `${art} ${nameOf(lose)} até tá um pouco maior, ${lose.m.waveMin} a ${lose.m.waveMax}m, mas o swell pega pior lá.`
        : `${art} ${nameOf(lose)} tá com ${lose.m.waveMin} a ${lose.m.waveMax}m.`
      return `Agora eu iria ${goTo}: o swell de ${swell} entra melhor lá, com onda de ${win.m.waveMin} a ${win.m.waveMax}m e ${wind(win.beach)}. ${loseLine}`
    },
  },
  {
    q: 'E no fim de semana, como vão estar as praias do sul da ilha?',
    a: (_spots, weekend) => (weekend ? weekendAnswer(weekend) : null),
  },
]

export function ChatDemo() {
  const { conditions } = useSurfData()
  const [active, setActive] = useState(0)
  const [typing, setTyping] = useState(false)
  const [weekend, setWeekend] = useState<Weekend | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  // Previsão real do fim de semana no sul (Campeche e Matadeiro), buscada de antemão (cache 1h)
  useEffect(() => {
    let cancelled = false
    const jobs = WEEKEND_DAYS.flatMap(d => SOUTH.map(b =>
      fetch(`/api/landing-day?id=${b.id}&day=${d.offset}`)
        .then(r => (r.ok ? r.json() as Promise<FutureDay> : Promise.reject()))
        .then(data => ({ day: d.day, beach: b.name, data }))
    ))
    Promise.allSettled(jobs).then(res => {
      if (cancelled) return
      const ok = res.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []))
      if (ok.length > 0) setWeekend(ok)
    })
    return () => { cancelled = true }
  }, [])

  const answer = useMemo(
    () => (conditions.length > 0 ? QUESTIONS[active].a(conditions, weekend) : null),
    [active, conditions, weekend]
  )

  const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const ask = (i: number) => {
    if (i === active && !typing) return
    setActive(i)
    setTyping(true)
    if (timer.current) clearTimeout(timer.current)
    // "digitando..." curtinho; sem animação pra quem pediu menos movimento
    timer.current = setTimeout(() => setTyping(false), reduceMotion() ? 0 : 900)
  }

  // A primeira resposta "digita" sozinha quando a conversa aparece na tela (uma vez só)
  useEffect(() => {
    const el = boxRef.current
    if (!el || reduceMotion()) return
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      obs.disconnect()
      setTyping(true)
      timer.current = setTimeout(() => setTyping(false), 1100)
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const visibleQuestions = QUESTIONS.map((qa, i) => ({ qa, i })).filter(({ qa, i }) => i === 0 || conditions.length === 0 || qa.a(conditions, weekend) !== null)

  return (
    <div className="flex flex-col gap-4">
      <div ref={boxRef} className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15">
            <Sparkles className="h-4 w-4 text-primary" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold">Surf AI</div>
            <div className="text-[11px] text-muted-foreground">exemplo com a previsão real</div>
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
        {visibleQuestions.map(({ qa, i }) => (
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
