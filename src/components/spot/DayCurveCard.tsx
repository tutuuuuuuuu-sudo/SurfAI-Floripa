import { useMemo, useState } from 'react'
import { ArrowUp, MoveHorizontal } from 'lucide-react'
import { DayCurve } from '@/components/spot/DayCurve'
import { getRatingInfo } from '@/lib/rating'
import { formatWaveRange, WIND_DEG } from '@/lib/surfData'
import { directionName } from '@/lib/directions'
import { computeGoldenWindow } from '../../../api/_goldenWindow'

// Conteúdo do cartão "o dia numa curva": nota da hora escolhida, a DayCurve arrastável e onda /
// maré / vento / período daquela hora. Saiu do DayCurveDemo da landing em 08/out/2026 pra página
// Premium mostrar a mesma peça com um dia de exemplo. Quem usa põe dentro de um card
// (overflow-hidden rounded-2xl border bg-card). Trocar de dia: passar key nova (zera a hora).

export interface CurveDayHour {
  hour: number
  score: number
  waveHeight: number
  windSpeed: number
  windDirection: string
  swellPeriod: number
}
export interface CurveDay {
  hours: CurveDayHour[]
  best: CurveDayHour
  sunriseHour: number | null
  sunsetHour: number | null
  tideHeights: number[] | null
}

const fmt = (h: number) => `${String(h).padStart(2, '0')}h`

export function DayCurveCard({ data, caption }: { data: CurveDay; caption: string }) {
  const [selectedHour, setSelectedHour] = useState<number | null>(null)

  const goodWin = useMemo(() => {
    const gw = computeGoldenWindow(
      data.hours.map(h => ({ ...h, label: fmt(h.hour) })),
      data.best.hour, data.sunriseHour, data.sunsetHour
    )
    return gw ? { from: gw.startHour, to: gw.endHour } : null
  }, [data])

  const sel = data.hours.find(h => h.hour === (selectedHour ?? data.best.hour)) ?? data.best
  const info = getRatingInfo(sel.score)
  const tideNow = data.tideHeights ? data.tideHeights[sel.hour] : undefined
  const tideNext = data.tideHeights ? data.tideHeights[sel.hour + 1] : undefined
  const tideTrend = tideNow === undefined || tideNext === undefined ? null
    : tideNext > tideNow + 0.02 ? 'enchendo' : tideNext < tideNow - 0.02 ? 'secando' : 'parada'
  const windDeg = WIND_DEG[sel.windDirection.toUpperCase()]

  return (
    <>
      <div className="flex items-end justify-between gap-3 px-4 pt-4">
        <div>
          <div className="text-xs text-muted-foreground">{caption}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span key={`s${sel.hour}`} className="text-4xl font-black tabular-nums leading-none" style={{ color: info.scoreColor, animation: 'fadeIn 0.2s ease-out' }}>
              {sel.score.toFixed(1)}
            </span>
            <span className="text-sm font-bold" style={{ color: info.scoreColor }}>{info.label}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums text-foreground">{fmt(sel.hour)}</div>
          <div className="text-[11px] text-muted-foreground">{sel.hour === data.best.hour ? 'melhor hora do dia' : `melhor: ${fmt(data.best.hour)}`}</div>
        </div>
      </div>

      <div className="px-2 pt-1">
        <DayCurve
          hours={data.hours}
          selectedHour={sel.hour}
          bestHour={data.best.hour}
          sunriseHour={data.sunriseHour}
          sunsetHour={data.sunsetHour}
          goodWindow={goodWin}
          onSelect={setSelectedHour}
        />
      </div>

      {/* O que acontece na hora escolhida — onda, maré, vento, período */}
      <div key={sel.hour} className="grid grid-cols-2 gap-px border-t border-border/60 bg-border/60 sm:grid-cols-4" style={{ animation: 'fadeIn 0.2s ease-out' }}>
        <div className="bg-card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Onda</div>
          <div className="font-bold tabular-nums">{formatWaveRange(sel.waveHeight)}</div>
        </div>
        <div className="bg-card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Maré</div>
          <div className="font-bold">{tideTrend ?? 'sem dado'}</div>
        </div>
        <div className="bg-card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Vento</div>
          <div className="flex items-center gap-1 font-bold tabular-nums">
            {windDeg !== undefined && <ArrowUp className="h-3.5 w-3.5 text-primary" style={{ transform: `rotate(${windDeg + 180}deg)` }} aria-hidden="true" />}
            {Math.round(sel.windSpeed)}km/h
          </div>
          <div className="truncate text-[11px] text-muted-foreground">{sel.windDirection} {directionName(sel.windDirection)}</div>
        </div>
        <div className="bg-card px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Período</div>
          <div className="font-bold tabular-nums">{Math.round(sel.swellPeriod)}s</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><MoveHorizontal className="h-3.5 w-3.5" />Arraste pela curva</span>
        {goodWin && goodWin.to > goodWin.from && (
          <span>Janela boa: <strong className="font-semibold text-foreground">{fmt(goodWin.from)} às {fmt(goodWin.to)}</strong></span>
        )}
      </div>
    </>
  )
}
