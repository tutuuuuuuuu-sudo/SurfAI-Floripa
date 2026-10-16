import { useNavigate } from 'react-router-dom'
import { Sparkles, Crown, ChevronRight, MapPin } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { getRatingInfo } from '@/lib/rating'
import { dayName, windowLabel, TREND_FROM_DAY, type BeachWindow } from '@/lib/forecastWindows'
import type { Region } from '@/lib/homeRegion'

// "Melhores janelas" (09/out/2026): a pergunta de quem abre a aba Previsão é "quando e onde vale
// surfar?" — o melhor dia, praia e horário dos próximos dias, de toda a ilha. Toca e abre o dia.
// 09/out/2026: abre na região que a pessoa mais frequenta (src/lib/homeRegion.ts), com a ilha toda
// numa aba ao lado e um aviso quando fora da região tem algo pelo menos 1 ponto melhor.
export function BestWindows({ windows, loading, isPremium, days, region, islandAlert }: {
  windows: BeachWindow[]
  loading: boolean
  isPremium: boolean
  days: number
  region?: { region: Region; reason: string; active: 'region' | 'island'; onChange: (s: 'region' | 'island') => void } | null
  islandAlert?: BeachWindow | null
}) {
  const navigate = useNavigate()
  const inRegion = !!region && region.active === 'region'
  const tab = (active: boolean) =>
    `flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${active ? 'bg-card shadow-sm text-foreground border border-border/40' : 'text-muted-foreground hover:text-foreground'}`
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-bold text-sm">Melhores janelas</h2>
        <span className="text-xs text-muted-foreground">· {inRegion ? region.region : 'a ilha toda'}, próximos {days} dias</span>
      </div>

      {region && (
        <div className="space-y-1">
          <div className="flex gap-1 rounded-xl bg-muted/30 p-1">
            <button className={tab(region.active === 'region')} onClick={() => region.onChange('region')}>
              {region.region} · sua região
            </button>
            <button className={tab(region.active === 'island')} onClick={() => region.onChange('island')}>
              Ilha toda
            </button>
          </div>
          {inRegion && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />Sua região {region.reason}
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-[132px] rounded-2xl" />)}
        </div>
      ) : windows.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-4 text-sm text-muted-foreground">
          Nenhuma janela boa à vista {inRegion ? `no ${region.region} ` : ''}nos próximos {days} dias. Vale olhar de novo amanhã.
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

      {islandAlert && !loading && (
        <button
          onClick={() => navigate(`/forecast/${islandAlert.beachId}/day/${islandAlert.day.dayIndex}`)}
          className="w-full flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-left text-xs"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <span className="flex-1">
            Na ilha toda, o melhor é <span className="font-semibold">{islandAlert.beachName}</span>: {dayName(islandAlert.day)} · {windowLabel(islandAlert.day)} ·{' '}
            <span className={`font-bold ${getRatingInfo(islandAlert.day.score).color}`}>{islandAlert.day.score.toFixed(1)}</span>
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        </button>
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
