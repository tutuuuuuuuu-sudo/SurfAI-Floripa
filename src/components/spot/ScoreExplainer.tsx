import { X, Waves, Clock, Wind } from 'lucide-react'
import { BeachCondition } from '@/lib/surfData'
import { getRatingInfo } from '@/lib/rating'
import { explainSurfScore } from '../../../api/_scoreEngine'
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock'

const WIND_QUALITY_LABEL: Record<string, string> = {
  offshore: 'offshore, deixa a onda limpa',
  lateral: 'lateral',
  onshore: 'onshore, bagunça a onda',
}

const fmtSigned = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}`
const adjustColor = (n: number) => n < 0 ? 'text-rating-poor' : n > 0 ? 'text-rating-good' : 'text-muted-foreground'

export const ScoreExplainer = ({ spot, onClose }: { spot: BeachCondition, onClose: () => void }) => {
  const rating = getRatingInfo(spot.score)
  useBodyScrollLock(true)
  // Mesma função que gera a nota de verdade (api/_scoreEngine.ts) — os três números
  // abaixo somam exatamente pra spot.score, não é mais uma ilustração aproximada.
  const breakdown = explainSurfScore(spot.waveHeight, spot.windSpeed, spot.swellPeriod, spot.windDirection, spot._beachOrientation ?? 90)

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Como calculamos a nota</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="h-5 w-5 text-muted-foreground"/></button>
        </div>
        <div className={`text-6xl font-bold text-center mb-1 ${rating.color}`}>{spot.score.toFixed(1)}</div>
        <div className={`text-center text-sm font-bold mb-6 ${rating.color}`}>{rating.label}</div>

        <div className="space-y-4">
          {/* Ondulação é a BASE (4 a 10) — vento e período só ajustam ela pra cima ou baixo,
              não são notas próprias que somadas dividem por 3. Mostrar os três como barras
              de /10 independentes fazia a soma não bater com a nota final. */}
          <div className="flex items-center gap-3">
            <Waves className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold">Ondulação (base)</span>
                <span className="text-sm font-bold text-primary">{breakdown.waveBase.toFixed(1)}/10</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div className="bg-primary h-1.5 rounded-full transition-all duration-700" style={{ width: `${breakdown.waveBase * 10}%` }}/>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{spot.waveHeight.toFixed(1)}m</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Wind className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold">Vento</span>
                <span className={`text-sm font-bold ${adjustColor(breakdown.windPenalty)}`}>{fmtSigned(breakdown.windPenalty)}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {Math.round(spot.windSpeed)}km/h {spot.windDirection} · {WIND_QUALITY_LABEL[breakdown.windQuality]}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold">Período</span>
                <span className={`text-sm font-bold ${adjustColor(breakdown.periodAdjust)}`}>{fmtSigned(breakdown.periodAdjust)}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{Math.round(spot.swellPeriod)}s entre ondas</div>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-center gap-1.5 text-sm font-mono flex-wrap text-muted-foreground">
          <span>{breakdown.waveBase.toFixed(1)}</span>
          <span>{fmtSigned(breakdown.windPenalty)}</span>
          <span>{fmtSigned(breakdown.periodAdjust)}</span>
          <span>=</span>
          <span className={`font-bold ${rating.color}`}>{spot.score.toFixed(1)}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">A ondulação define a base; vento e período ajustam pra cima ou pra baixo</p>
      </div>
    </div>
  )
}
