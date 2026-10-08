import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { getRatingInfo } from '@/lib/rating'
import { todaySP } from '@/lib/timeSP'
import { FREE_DAYS } from '@/lib/weatherData'
import { useReveal } from '@/hooks/use-reveal'

// Topo da página Premium (08/out/2026, 2ª versão): o usuário pediu "números que o usuário veja a
// diferença e sinta que isso é necessário pra ele", com exemplo em vez de dado ao vivo, e não
// gostou da carteirinha com a foto. Aqui é uma quinzena de EXEMPLO na Joaquina: no grátis a
// previsão acaba no 3º dia; no Premium aparece o dia clássico (sábado que vem, 8.6) que estava
// escondido. Começa no "Grátis" e vira "Premium" sozinho quando aparece na tela; dá pra alternar.

const DAYS = 14
const WEEKDAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const WEEKDAY_FULL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const PEAK = 8.6
// Notas de um mar comum, com a ondulação crescendo até o pico e indo embora depois
const BASE = [3.9, 4.4, 3.2, 2.7, 3.5, 4.1, 3.6, 3.3, 4.0, 3.8, 3.1, 3.7, 4.5, 4.2]
const AROUND_PEAK: Record<number, number> = { [-2]: 5.4, [-1]: 7.1, 0: PEAK, 1: 7.6, 2: 5.9 }

function quinzena() {
  const base = new Date(`${todaySP()}T12:00:00`)
  const dates = Array.from({ length: DAYS }, (_, i) => new Date(base.getTime() + i * 86_400_000))
  // Pico no primeiro sábado que o grátis não mostra (sempre cai entre o 5º e o 11º dia)
  const peak = dates.findIndex((d, i) => i >= FREE_DAYS + 2 && d.getDay() === 6)
  const scores = BASE.map((s, i) => AROUND_PEAK[i - peak] ?? s)
  return { dates, scores, peak }
}

export function ForecastTeaser() {
  const { ref, visible } = useReveal(0.5)
  const [mode, setMode] = useState<'free' | 'premium'>('free')
  const [touched, setTouched] = useState(false)
  const { dates, scores, peak } = quinzena()
  const premium = mode === 'premium'
  const peakInfo = getRatingInfo(PEAK)
  const peakDate = dates[peak]

  // Mostra o "Grátis" por um instante e abre o resto sozinho (até a pessoa mexer no seletor)
  useEffect(() => {
    if (!visible || touched) return
    const t = setTimeout(() => setMode('premium'), 1400)
    return () => clearTimeout(t)
  }, [visible, touched])

  const pick = (m: 'free' | 'premium') => { setTouched(true); setMode(m) }

  return (
    <div ref={ref} className="rounded-3xl border border-border/60 bg-card p-4 text-left shadow-xl shadow-primary/10">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold">Joaquina</div>
          <div className="text-[11px] text-muted-foreground">Próximos 14 dias · exemplo</div>
        </div>
        <div className="flex rounded-full bg-muted p-0.5 text-xs font-semibold" role="tablist" aria-label="Ver a previsão como">
          {(['free', 'premium'] as const).map(m => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => pick(m)}
              className={`rounded-full px-3 py-1 transition-colors ${mode === m
                ? m === 'premium' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground'}`}>
              {m === 'free' ? 'Grátis' : 'Premium'}
            </button>
          ))}
        </div>
      </div>

      {/* Barras: altura e cor pela nota de cada dia. pt-9 = espaço pro número do dia clássico */}
      <div className="relative mt-2 pt-9">
        <div className="relative grid h-32 grid-cols-14 items-end gap-1">
          {scores.map((s, i) => {
            const hidden = !premium && i >= FREE_DAYS
            const isPeak = i === peak
            return (
              <div
                key={i}
                className={`relative w-full rounded-t-md transition-all duration-700 ease-out ${isPeak && premium ? 'shadow-lg' : ''}`}
                style={{
                  height: hidden ? '18%' : `${Math.max(12, s * 10)}%`,
                  background: hidden ? 'var(--muted)' : getRatingInfo(s).scoreColor,
                  opacity: hidden ? 0.6 : 1,
                  transitionDelay: premium && i >= FREE_DAYS ? `${(i - FREE_DAYS) * 45}ms` : '0ms',
                }}
              >
                {isPeak && premium && (
                  <div className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap text-center"
                    style={{ animation: 'fadeIn 0.4s 0.8s ease-out both' }}>
                    <div className="text-sm font-black tabular-nums leading-none" style={{ color: peakInfo.scoreColor }}>{PEAK.toFixed(1)}</div>
                    <div className="text-[8px] font-bold tracking-wider" style={{ color: peakInfo.scoreColor }}>{peakInfo.label}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {/* Cadeado sobre os dias que o grátis não mostra */}
        <div className={`pointer-events-none absolute bottom-0 top-9 right-0 flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-card/70 text-center backdrop-blur-[2px] transition-opacity duration-500 ${premium ? 'opacity-0' : 'opacity-100'}`}
          style={{ left: `calc(${(FREE_DAYS / DAYS) * 100}% + 2px)` }}>
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-muted-foreground">11 dias que o grátis não mostra</span>
        </div>
      </div>

      <div className="mt-1.5 grid grid-cols-14 gap-1 text-center text-[9px] tabular-nums text-muted-foreground">
        {dates.map((d, i) => (
          <span key={i} className={i === peak && premium ? 'font-bold text-foreground' : ''}>{d.getDate()}</span>
        ))}
      </div>

      <div className="mt-3 min-h-[2.5rem] rounded-xl bg-muted/50 px-3 py-2 text-xs leading-relaxed">
        {premium ? (
          <span key="p" className="anim-fade block">
            O melhor dia da quinzena é <span className="font-bold">{WEEKDAY_FULL[peakDate.getDay()]}, {peakDate.getDate()}</span>: nota{' '}
            <span className="font-bold" style={{ color: peakInfo.scoreColor }}>{PEAK.toFixed(1)}</span>, onda de 1.6 a 1.9m com 13 segundos.
          </span>
        ) : (
          <span key="f" className="anim-fade block text-muted-foreground">
            No grátis, a previsão acaba {WEEKDAY[dates[FREE_DAYS - 1].getDay()]}, dia {dates[FREE_DAYS - 1].getDate()}. Até lá, nada passa de nota {Math.max(...scores.slice(0, FREE_DAYS)).toFixed(1)}.
          </span>
        )}
      </div>
    </div>
  )
}
