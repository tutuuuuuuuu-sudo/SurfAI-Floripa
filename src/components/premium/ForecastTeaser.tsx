import { useEffect, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Crown, Lock } from 'lucide-react'
import { ForecastDayCard } from '@/components/spot/ForecastDayCard'
import { getRatingInfo } from '@/lib/rating'
import { todaySP } from '@/lib/timeSP'
import { FREE_DAYS, type WeatherForecast } from '@/lib/weatherData'
import { useReveal } from '@/hooks/use-reveal'

// Topo da página Premium (08/out/2026, 3ª versão). O usuário pediu números de exemplo "que o
// usuário veja a diferença" e depois: "vamos usar o que o app já usa, que já é validado e é
// bonito" — o gráfico de barras próprio ficou "feio e genérico". Aqui é a MESMA aba Previsão da
// página da praia (ForecastDayCard + abas no mesmo estilo), com uma quinzena de EXEMPLO na
// Joaquina: no Grátis aparecem 3 dias e o resto trancado; no Premium os 14, com o sábado
// clássico (8.6) em destaque. Começa no Grátis e abre o Premium sozinho quando aparece na tela.

const DAYS = 14
const WEEKDAY = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const WEEKDAY_FULL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const PEAK = 8.6
// Notas de um mar comum, com a ondulação crescendo até o pico e indo embora depois
const BASE = [3.9, 4.4, 3.2, 2.7, 3.5, 4.1, 3.6, 3.3, 4.0, 3.8, 3.1, 3.7, 4.5, 4.2]
const AROUND_PEAK: Record<number, number> = { [-2]: 5.4, [-1]: 7.1, 0: PEAK, 1: 7.6, 2: 5.9 }

function quinzena(): { days: WeatherForecast[]; peak: number } {
  const base = new Date(`${todaySP()}T12:00:00`)
  const dates = Array.from({ length: DAYS }, (_, i) => new Date(base.getTime() + i * 86_400_000))
  // Pico no primeiro sábado que o grátis não mostra (sempre cai entre o 6º e o 12º dia)
  const peak = dates.findIndex((d, i) => i >= FREE_DAYS + 2 && d.getDay() === 6)
  const days = dates.map((d, i): WeatherForecast => {
    const score = AROUND_PEAK[i - peak] ?? BASE[i]
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      dayName: i === 1 ? 'Amanhã' : WEEKDAY[d.getDay()],
      // Onda maior e vento mais fraco nos dias bons, como no mar de verdade
      waveHeight: Math.round((0.4 + score * 0.15) * 10) / 10,
      windSpeed: Math.round(30 - score * 2.8),
      windDirection: score >= 7 ? 'W' : 'NE',
      swellPeriod: score >= 7 ? 13 : 7,
      temperature: 20 + (i % 3),
      condition: 'Regular',
      score,
    }
  })
  return { days, peak }
}

export function ForecastTeaser() {
  const { ref, visible } = useReveal(0.4)
  const [mode, setMode] = useState<'free' | 'premium'>('free')
  const [touched, setTouched] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const peakRef = useRef<HTMLDivElement>(null)
  const [{ days, peak }] = useState(quinzena)
  const premium = mode === 'premium'
  const peakDay = new Date(`${days[peak].date}T12:00:00`)
  const lastFree = new Date(`${days[FREE_DAYS - 1].date}T12:00:00`)

  // Mostra o Grátis por um instante e abre o Premium sozinho (até a pessoa mexer nas abas)
  useEffect(() => {
    if (!visible || touched) return
    const t = setTimeout(() => setMode('premium'), 1600)
    return () => clearTimeout(t)
  }, [visible, touched])

  // No Premium, rola a faixa de dias até o sábado clássico
  useEffect(() => {
    if (!premium) return
    const t = setTimeout(() => {
      const row = rowRef.current, card = peakRef.current
      if (row && card) row.scrollTo({ left: card.offsetLeft - row.clientWidth / 2 + card.clientWidth / 2, behavior: 'smooth' })
    }, 500)
    return () => clearTimeout(t)
  }, [premium])

  const pick = (m: 'free' | 'premium') => { setTouched(true); setMode(m) }

  // Faixa dos 14 dias: no celular o dedo já rola; no computador dá pra arrastar com o mouse e
  // tem setas dos lados (o usuário não conseguia ver os outros dias no PC, 08/out/2026)
  const drag = useRef<{ x: number; left: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [edges, setEdges] = useState({ start: true, end: false })
  const updateEdges = () => {
    const row = rowRef.current
    if (row) setEdges({ start: row.scrollLeft < 8, end: row.scrollLeft + row.clientWidth > row.scrollWidth - 8 })
  }
  const scrollByCards = (dir: 1 | -1) => rowRef.current?.scrollBy({ left: dir * rowRef.current.clientWidth * 0.66, behavior: 'smooth' })
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || !rowRef.current) return
    drag.current = { x: e.clientX, left: rowRef.current.scrollLeft }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current && rowRef.current) rowRef.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x)
  }
  const endDrag = () => { drag.current = null; setDragging(false) }

  return (
    <div ref={ref} className="space-y-4 text-left">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Próximos dias · Joaquina</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Exemplo de uma quinzena</p>
        </div>
      </div>

      {/* Mesmas abas da página da praia (Agora / Previsão) */}
      <div className="flex rounded-xl bg-muted/30 p-1 border border-border/30" role="tablist" aria-label="Ver a previsão como">
        {(['free', 'premium'] as const).map(m => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => pick(m)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === m ? 'bg-card shadow-sm text-foreground border border-border/40' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {m === 'free'
              ? <><Calendar className="h-4 w-4" />Grátis: {FREE_DAYS} dias</>
              : <><Crown className="h-4 w-4 text-rating-fair" />Premium: {DAYS} dias</>}
          </button>
        ))}
      </div>

      {premium ? (
        <div key="p" className="relative">
          <div ref={rowRef} onScroll={updateEdges}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
            className={`-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none ${dragging ? 'cursor-grabbing select-none' : 'cursor-grab snap-x'}`}>
            {days.map((day, i) => (
              <div key={day.date} ref={i === peak ? peakRef : undefined} className="w-[31%] shrink-0 snap-center">
                <ForecastDayCard day={day} index={i} isPremium usesFeet={false} freeDays={FREE_DAYS} onUpgrade={() => {}} highlight={i === peak} />
              </div>
            ))}
          </div>
          {!edges.start && (
            <button type="button" onClick={() => scrollByCards(-1)} aria-label="Dias anteriores"
              className="absolute -left-2 sm:-left-6 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/95 shadow-lg transition-colors hover:border-primary/50">
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {!edges.end && (
            <button type="button" onClick={() => scrollByCards(1)} aria-label="Próximos dias"
              className="absolute -right-2 sm:-right-6 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/95 shadow-lg transition-colors hover:border-primary/50">
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <div key="f" className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {days.slice(0, FREE_DAYS).map((day, i) => (
              <ForecastDayCard key={day.date} day={day} index={i} isPremium={false} usesFeet={false} freeDays={FREE_DAYS} onUpgrade={() => pick('premium')} />
            ))}
          </div>
          {/* Mesmo quadro que a conta grátis vê na página da praia */}
          <button type="button" onClick={() => pick('premium')}
            className="w-full py-4 rounded-2xl border border-dashed border-rating-fair/40 bg-rating-fair/5 hover:bg-rating-fair/10 transition-colors text-center">
            <Lock className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
            <div className="text-sm font-semibold text-rating-fair">Mais {DAYS - FREE_DAYS} dias escondidos</div>
            <div className="text-xs text-muted-foreground mt-0.5">Toque pra ver o que o Premium mostra</div>
          </button>
        </div>
      )}

      <div className="rounded-xl bg-muted/40 px-3.5 py-2.5 text-sm leading-relaxed">
        {premium ? (
          <span key="p" className="anim-fade block">
            O melhor dia da quinzena é <span className="font-bold">{WEEKDAY_FULL[peakDay.getDay()]}, {peakDay.getDate()}</span>: nota{' '}
            <span className="font-bold" style={{ color: getRatingInfo(PEAK).scoreColor }}>{PEAK.toFixed(1)}</span>, onda de 1.7m com 13 segundos.
          </span>
        ) : (
          <span key="f" className="anim-fade block text-muted-foreground">
            No grátis, a previsão acaba {WEEKDAY_FULL[lastFree.getDay()]}, dia {lastFree.getDate()}. O que vem depois, você não vê.
          </span>
        )}
      </div>
    </div>
  )
}
