import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Waves, Wind, Thermometer, TrendingUp, TrendingDown, Minus, Check } from 'lucide-react'
import type { Trend } from '@/lib/compareTrend'

// Tabela "Comparativo Detalhado" da tela Comparar Praias: nota, onda, período, vento e água lado a
// lado, com o "melhor" marcado em cada linha, mais a tendência das próximas 3 horas. Saiu de
// Compare.tsx em 08/out/2026 pra página Premium mostrar a MESMA comparação no exemplo (o usuário
// achou que só os cartões com a nota "não mostram uma comparação real").

export interface CompareRow {
  id: string
  score: number
  waveHeight: number
  swellPeriod: number
  windSpeed: number
  waterTemp: number
}

const TREND_INFO: Record<Trend, { icon: typeof TrendingUp; label: string; className: string }> = {
  up:      { icon: TrendingUp,   label: 'Melhorando', className: 'text-rating-good' },
  down:    { icon: TrendingDown, label: 'Piorando',   className: 'text-rating-poor' },
  stable:  { icon: Minus,        label: 'Estável',    className: 'text-muted-foreground' },
}

const METRICS = [
  { key: 'score',       label: 'Nota IA',          icon: TrendingUp,  format: (v: number) => v.toFixed(1),           higher: true,  get: (s: CompareRow) => s.score },
  { key: 'waveHeight',  label: 'Altura das Ondas', icon: Waves,       format: (v: number) => `${v.toFixed(1)}m`,     higher: true,  get: (s: CompareRow) => s.waveHeight },
  { key: 'swellPeriod', label: 'Período',          icon: Waves,       format: (v: number) => `${Math.round(v)}s`,    higher: true,  get: (s: CompareRow) => s.swellPeriod },
  { key: 'windSpeed',   label: 'Vento',            icon: Wind,        format: (v: number) => `${Math.round(v)}km/h`, higher: false, get: (s: CompareRow) => s.windSpeed },
  { key: 'waterTemp',   label: 'Água',             icon: Thermometer, format: (v: number) => `${v}°C`,               higher: true,  get: (s: CompareRow) => s.waterTemp },
]

export function CompareTable({ spots, trends }: { spots: CompareRow[]; trends: Record<string, Trend> }) {
  const getBest = (metric: typeof METRICS[number]): string => {
    if (spots.length < 2) return ''
    const vals = spots.map(s => ({ id: s.id, val: metric.get(s) }))
    const best = metric.higher
      ? vals.reduce((a, b) => b.val > a.val ? b : a)
      : vals.reduce((a, b) => b.val < a.val ? b : a)
    // Só destaca se houver diferença
    const allSame = vals.every(v => v.val === vals[0].val)
    return allSame ? '' : best.id
  }
  const cols = spots.length === 3 ? 'grid-cols-4' : 'grid-cols-3'

  return (
    <Card style={{ animation: 'slideUp 0.4s ease-out' }}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Comparativo Detalhado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        {METRICS.map((metric, mIdx) => {
          const bestId = getBest(metric)
          return (
            <div key={metric.key} className={`grid gap-2 py-3 ${cols} ${mIdx !== 0 ? 'border-t' : ''}`}>
              <div className="flex items-center gap-1.5">
                <metric.icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground">{metric.label}</span>
              </div>
              {spots.map(spot => {
                const isBest = spot.id === bestId
                return (
                  <div key={spot.id} className={`text-center rounded-lg py-1.5 ${isBest ? 'bg-primary/10' : ''}`}>
                    <div className={`text-sm font-bold ${isBest ? 'text-primary' : ''}`}>
                      {metric.format(metric.get(spot))}
                    </div>
                    {isBest && <div className="flex items-center justify-center gap-0.5 text-xs text-primary"><Check className="h-3 w-3" />melhor</div>}
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* Tendência das próximas horas — não entra no "melhor" das outras métricas
            porque não é um valor do momento atual, é uma direção */}
        <div className={`grid gap-2 py-3 border-t ${cols}`}>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">Tendência (3h)</span>
          </div>
          {spots.map(spot => {
            const trend = trends[spot.id]
            const info = trend ? TREND_INFO[trend] : null
            return (
              <div key={spot.id} className="text-center rounded-lg py-1.5">
                {info ? (
                  <div className={`inline-flex items-center gap-1 text-xs font-semibold ${info.className}`}>
                    <info.icon className="h-3.5 w-3.5" />{info.label}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">···</span>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
