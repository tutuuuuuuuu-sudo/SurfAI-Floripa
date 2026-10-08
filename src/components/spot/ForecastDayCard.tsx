import { Waves, Wind, Thermometer, Lock, Crown, ChevronRight } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { getRatingInfo } from '@/lib/rating'
import type { WeatherForecast } from '@/lib/weatherData'

// Cartão de um dia da previsão (aba Previsão da página da praia). Saiu de SpotDetails.tsx em
// 08/out/2026 pra página Premium mostrar o MESMO cartão no exemplo dos 14 dias (pedido do
// usuário: "vamos usar o que o app já usa, que já é validado e é bonito").

const metersToFeet = (m: number): string => `${(m * 3.281).toFixed(1)}ft`

export function ForecastDayCard({
  day, index, isPremium, usesFeet, freeDays, onUpgrade, onOpen, highlight
}: {
  day: WeatherForecast
  index: number
  isPremium: boolean
  usesFeet: boolean
  freeDays: number
  onUpgrade: () => void
  // Sem onOpen (exemplo da página Premium) o cartão não é clicável e não mostra "Ver dia"
  onOpen?: () => void
  // Destaque do dia clássico no exemplo da página Premium
  highlight?: boolean
}) {
  const isLocked = index >= freeDays && !isPremium
  const isToday = index === 0
  const rating = getRatingInfo(day.score)

  if (isLocked) {
    return (
      <button
        onClick={onUpgrade}
        className="flex flex-col items-center justify-center gap-1 p-3 rounded-2xl border border-dashed border-border/40 bg-muted/10 hover:bg-muted/20 transition-all min-h-[120px]"
        style={{animation:`fadeIn 0.4s ${index*0.05}s ease-out both`}}
      >
        <Lock className="h-4 w-4 text-muted-foreground/50 mb-1"/>
        <div className="text-xs font-bold text-muted-foreground">{day.dayName}</div>
        <Crown className="h-3.5 w-3.5 text-rating-fair"/>
      </button>
    )
  }

  // Clicável: abre o detalhe hora a hora desse dia direto daqui, sem precisar passar pela
  // aba Previsão do menu inferior e achar a praia de novo (pedido do usuário 25/set/2026)
  const Tag = onOpen ? 'button' : 'div'
  return (
    <Tag
      {...(onOpen ? { type: 'button' as const, onClick: onOpen } : {})}
      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        onOpen ? 'cursor-pointer active:scale-95' : ''
      } ${
        highlight ? 'bg-rating-epic/10 border-rating-epic/60 ring-2 ring-rating-epic/40 shadow-lg'
          : isToday ? 'bg-primary/8 border-primary/30 shadow-sm hover:border-primary/50' : 'bg-card border-border/40 hover:border-primary/40'
      }`}
      style={{animation:`fadeIn 0.4s ${index*0.05}s ease-out both`}}
    >
      <div className="text-center">
        <div className={`text-xs font-bold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
          {isToday ? 'Hoje' : day.dayName}
        </div>
        <div className="text-xs text-muted-foreground/60">
          {new Date(day.date+'T12:00:00').toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit'})}
        </div>
      </div>
      <div className={`text-2xl font-bold ${rating.color}`}>{Number(day.score).toFixed(1)}</div>
      <div className={`text-xs font-semibold ${rating.color}`}>{rating.label}</div>
      <div className="flex gap-0.5">{[1,2,3,4,5].map(i=><div key={i} className={`h-1 w-3.5 rounded-full ${i<=rating.bars?rating.bg:'bg-muted'}`}/>)}</div>
      <Separator className="w-full opacity-30"/>
      <div className="w-full space-y-1">
        <div className="flex items-center justify-between">
          <Waves className="h-3 w-3 text-muted-foreground"/>
          <span className="text-xs font-semibold">{usesFeet ? metersToFeet(day.waveHeight) : `${Number(day.waveHeight).toFixed(1)}m`}</span>
        </div>
        <div className="flex items-center justify-between">
          <Wind className="h-3 w-3 text-muted-foreground"/>
          <span className="text-xs font-semibold">{Math.round(day.windSpeed)}km/h</span>
        </div>
        <div className="flex items-center justify-between">
          <Thermometer className="h-3 w-3 text-muted-foreground"/>
          <span className="text-xs font-semibold">{day.temperature}°C</span>
        </div>
      </div>
      {onOpen && (
        <div className="flex items-center gap-0.5 text-[10px] font-semibold text-primary">
          Ver dia<ChevronRight className="h-3 w-3"/>
        </div>
      )}
    </Tag>
  )
}
