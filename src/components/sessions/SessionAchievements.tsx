import { Flame, CalendarDays, Clock, Stamp, Trophy, Star } from 'lucide-react'
import type { SurfSession } from '@/lib/sessions'
import { monthSummary, weekStreak, surfedBeaches, yearRecap } from '@/lib/sessionStats'
import { BEACH_REGISTRY } from '../../../api/_beachRegistry'

const hours = (minutes: number) => (minutes >= 60 ? `${Math.round(minutes / 60)}h` : `${minutes}min`)

// Números do mês e semanas seguidas
export function SessionStatsRow({ sessions, today }: { sessions: SurfSession[]; today: string }) {
  const month = monthSummary(sessions, today)
  const streak = weekStreak(sessions, today)
  const items = [
    { Icon: CalendarDays, value: String(month.count), label: month.count === 1 ? 'sessão no mês' : 'sessões no mês' },
    { Icon: Clock, value: hours(month.minutes), label: 'na água no mês' },
    { Icon: Flame, value: String(streak), label: streak === 1 ? 'semana seguida' : 'semanas seguidas' },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(({ Icon, value, label }) => (
        <div key={label} className="rounded-2xl border border-border/50 bg-card py-3 px-2 text-center">
          <Icon className="h-4 w-4 text-primary mx-auto mb-1" />
          <div className="text-xl font-bold leading-tight">{value}</div>
          <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
        </div>
      ))}
    </div>
  )
}

// Passaporte da ilha: as 14 praias de norte a sul, carimbadas quando a pessoa surfou
export function IslandPassport({ sessions }: { sessions: SurfSession[] }) {
  const surfed = surfedBeaches(sessions)
  const beaches = [...BEACH_REGISTRY].sort((a, b) => b.lat - a.lat)
  const done = beaches.filter(b => surfed.has(b.id)).length
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Stamp className="h-4 w-4 text-primary" />
          <span className="font-bold text-sm">Passaporte da ilha</span>
        </div>
        <span className="text-xs font-semibold text-muted-foreground">{done} de {beaches.length} praias</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {beaches.map(b => {
          const count = surfed.get(b.id) ?? 0
          return (
            <div key={b.id} className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs ${
              count ? 'bg-primary/12 border border-primary/40 font-semibold' : 'border border-dashed border-border/60 text-muted-foreground/70'
            }`}>
              <span className="truncate">{b.name}</span>
              {count > 0 && <span className="text-primary flex-shrink-0 ml-1">{count}×</span>}
            </div>
          )
        })}
      </div>
      {done === beaches.length && (
        <div className="mt-3 text-xs font-semibold text-rating-good text-center">Ilha inteira carimbada. Lenda local!</div>
      )}
    </div>
  )
}

// Retrospectiva do ano
export function YearRecap({ sessions, year }: { sessions: SurfSession[]; year: string }) {
  const r = yearRecap(sessions, year)
  if (r.count === 0) return null
  const best = r.best
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-rating-fair" />
        <span className="font-bold text-sm">Seu {year} até agora</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div><div className="text-lg font-bold">{r.count}</div><div className="text-[11px] text-muted-foreground">sessões</div></div>
        <div><div className="text-lg font-bold">{hours(r.minutes)}</div><div className="text-[11px] text-muted-foreground">na água</div></div>
        <div><div className="text-lg font-bold">{r.beachCount}</div><div className="text-[11px] text-muted-foreground">{r.beachCount === 1 ? 'praia' : 'praias'}</div></div>
      </div>
      <div className="space-y-1.5 text-sm">
        {r.favorite && (
          <div className="flex justify-between gap-2"><span className="text-muted-foreground">Praia preferida</span><span className="font-semibold">{r.favorite.name} ({r.favorite.count}×)</span></div>
        )}
        {best && best.rating && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Melhor sessão</span>
            <span className="font-semibold flex items-center gap-1">
              {best.beach_name}, {new Date(`${best.date}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
              <Star className="h-3.5 w-3.5 text-rating-fair fill-rating-fair" />{best.rating}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
