import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Crown, Lock, Waves, Wind, ArrowUpDown, MapPin, CalendarClock, ChevronRight } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import type { SurfSession } from '@/lib/sessions'
import { learnIdealSea, findNextIdealSea, describeIdealSea, IDEAL_MIN_SESSIONS } from '@/lib/idealSea'
import { fetchIslandWindows, dayName, windowLabel, TREND_FROM_DAY, type BeachWindow } from '@/lib/forecastWindows'
import { getRatingInfo } from '@/lib/rating'

// "Seu mar ideal" (Premium): o que a pessoa curte, aprendido das estrelas, e a próxima vez
// que esse mar aparece nos 14 dias
export function IdealSeaCard({ sessions, isPremium }: { sessions: SurfSession[]; isPremium: boolean }) {
  const navigate = useNavigate()
  const status = learnIdealSea(sessions)
  const [next, setNext] = useState<BeachWindow | null | undefined>(undefined)
  const ideal = status.state === 'ready' ? status.ideal : null

  useEffect(() => {
    if (!isPremium || !ideal) return
    let cancelled = false
    fetchIslandWindows(true).then(data => {
      if (!cancelled) setNext(data ? findNextIdealSea(ideal, data.beaches) : null)
    })
    return () => { cancelled = true }
  }, [isPremium, ideal?.waveMin, ideal?.waveMax, ideal?.maxWind, ideal?.tideTrend, ideal?.windDirections.join(), ideal?.beaches.map(b => b.id).join()]) // eslint-disable-line react-hooks/exhaustive-deps

  const header = (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1">
        <div className="font-bold text-sm">Seu mar ideal</div>
        <div className="text-xs text-muted-foreground">O app aprende com as suas estrelas</div>
      </div>
      {!isPremium && <Crown className="h-4 w-4 text-rating-fair" />}
    </div>
  )

  if (!isPremium) {
    return (
      <button onClick={() => navigate('/premium')} className="w-full text-left rounded-2xl border border-rating-fair/30 bg-card p-4 hover:border-rating-fair/60 transition-colors">
        {header}
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <Lock className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>Com o Premium, o app cruza as estrelas das suas sessões com o mar de cada hora, descobre do que você gosta e avisa quando esse mar volta.</span>
        </div>
      </button>
    )
  }

  if (status.state === 'learning') {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-4">
        {header}
        <p className="text-sm text-muted-foreground mb-3">
          {status.rated === 0
            ? `Registre ${IDEAL_MIN_SESSIONS} sessões com estrelas e o app descobre o mar que você mais curte.`
            : `Faltam ${status.needed} ${status.needed === 1 ? 'sessão' : 'sessões'} com estrelas pro app descobrir o seu mar.`}
        </p>
        <Progress value={(status.rated / IDEAL_MIN_SESSIONS) * 100} className="h-1.5" />
        <div className="text-[11px] text-muted-foreground mt-1.5">{status.rated} de {IDEAL_MIN_SESSIONS}</div>
      </div>
    )
  }

  if (status.state === 'no-likes') {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-4">
        {header}
        <p className="text-sm text-muted-foreground">
          Ainda não deu pra saber: o app precisa de pelo menos 2 sessões de 4 ou 5 estrelas pra ver o que elas têm em comum.
        </p>
      </div>
    )
  }

  const d = describeIdealSea(status.ideal)
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
      {header}
      <div className="grid grid-cols-1 gap-1.5 text-sm">
        <span className="flex items-center gap-2"><Waves className="h-4 w-4 text-primary flex-shrink-0" />{d.wave}</span>
        <span className="flex items-center gap-2"><Wind className="h-4 w-4 text-primary flex-shrink-0" />{d.wind}</span>
        <span className="flex items-center gap-2"><ArrowUpDown className="h-4 w-4 text-primary flex-shrink-0" />{d.tide}</span>
        <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary flex-shrink-0" />{d.beaches}</span>
      </div>
      <div className="text-[11px] text-muted-foreground mt-2">Aprendido de {status.ideal.basedOn} sessões de 4 ou 5 estrelas</div>

      <div className="mt-3 pt-3 border-t border-primary/20">
        {next === undefined ? (
          <div className="text-sm text-muted-foreground">Procurando nos próximos 14 dias...</div>
        ) : next ? (
          <button onClick={() => navigate(`/forecast/${next.beachId}/day/${next.day.dayIndex}`)}
            className="w-full flex items-center gap-3 text-left">
            <CalendarClock className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">Próxima vez que ele aparece</div>
              <div className="font-semibold text-sm">
                {dayName(next.day)} · {next.beachName} · {windowLabel(next.day)}
                {next.day.dayIndex >= TREND_FROM_DAY && <span className="text-xs font-normal text-muted-foreground"> (tendência)</span>}
              </div>
            </div>
            <span className={`text-lg font-bold ${getRatingInfo(next.day.score).color}`}>{next.day.score.toFixed(1)}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ) : (
          <div className="text-sm text-muted-foreground">Nos próximos 14 dias o seu mar ideal não aparece. O app avisa aqui quando ele surgir.</div>
        )}
      </div>
    </div>
  )
}
