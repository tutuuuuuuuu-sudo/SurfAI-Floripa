import { useNavigate } from 'react-router-dom'
import { Sparkles, Crown, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { getRatingInfo } from '@/lib/rating'
import { dayName, windowLabel, TREND_FROM_DAY, type BeachWindow } from '@/lib/forecastWindows'

// "Melhores janelas" (09/out/2026): a pergunta de quem abre a aba Previsão é "quando e onde vale
// surfar?" — o melhor dia, praia e horário dos próximos dias, de toda a ilha. Toca e abre o dia.
export function BestWindows({ windows, loading, isPremium, days }: {
  windows: BeachWindow[]
  loading: boolean
  isPremium: boolean
  days: number
}) {
  const navigate = useNavigate()
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-bold text-sm">Melhores janelas</h2>
        <span className="text-xs text-muted-foreground">· a ilha toda, próximos {days} dias</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-[132px] rounded-2xl" />)}
        </div>
      ) : windows.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-4 text-sm text-muted-foreground">
          Nenhuma janela boa à vista nos próximos {days} dias. Vale olhar de novo amanhã.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {windows.map((w, i) => {
            const rating = getRatingInfo(w.day.score)
            const trend = w.day.dayIndex >= TREND_FROM_DAY
            return (
              <button
                key={`${w.beachId}-${w.day.dayIndex}`}
                onClick={() => navigate(`/forecast/${w.beachId}/day/${w.day.dayIndex}`)}
                className={`flex flex-col items-start text-left rounded-2xl border p-3 transition-all active:scale-95 hover:border-primary/50 ${
                  trend ? 'border-dashed border-border/60 bg-card/60' : 'border-border/50 bg-card'
                }`}
                style={{ animation: `slideUp 0.3s ${i * 0.06}s ease-out both` }}
              >
                <div className="text-xs font-bold text-primary">{dayName(w.day)}</div>
                <div className="text-sm font-semibold leading-tight mt-1 line-clamp-2 min-h-[2.5em]">{w.beachName}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{windowLabel(w.day)}</div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className={`text-2xl font-bold leading-none ${rating.color}`}>{w.day.score.toFixed(1)}</span>
                </div>
                <div className={`text-[10px] font-bold mt-0.5 ${rating.color}`}>{rating.label}</div>
                {trend && <div className="text-[10px] text-muted-foreground mt-1">tendência</div>}
              </button>
            )
          })}
        </div>
      )}

      {!isPremium && !loading && (
        <button onClick={() => navigate('/premium')} className="w-full flex items-center gap-2 text-xs font-semibold text-rating-fair">
          <Crown className="h-3.5 w-3.5" />Premium mostra as melhores janelas dos 14 dias
          <ChevronRight className="h-3.5 w-3.5 ml-auto" />
        </button>
      )}
    </section>
  )
}
