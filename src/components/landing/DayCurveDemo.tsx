import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUp, MoveHorizontal } from 'lucide-react'
import { DayCurve } from '@/components/spot/DayCurve'
import { getRatingInfo } from '@/lib/rating'
import { formatWaveRange, WIND_DEG } from '@/lib/surfData'
import { directionName } from '@/lib/directions'
import { useSurfData } from '@/contexts/SurfDataContext'
import { computeGoldenWindow } from '../../../api/_goldenWindow'
import { countLandingCta } from '@/lib/landingStats'

// "O dia numa curva" (landing v2, 28/set/2026): a MESMA DayCurve da página de previsão do
// app, com a previsão real de amanhã (api/landing-day.ts, sem login, cache 1h). Substitui a
// vitrine de prints do app (AppScrollShowcase), que ficava desatualizada a cada mudança de
// tela — aqui o visitante usa a peça de verdade, então ela nunca fica velha.

interface Hour {
  hour: number
  score: number
  waveHeight: number
  windSpeed: number
  windDirection: string
  swellPeriod: number
  swellDirection: string
}
interface DemoDay {
  date: string
  hours: Hour[]
  best: Hour
  sunriseHour: number | null
  sunsetHour: number | null
  tideHeights: number[] | null
  beach: { id: string; name: string }
}

// Praias abertas sem login (publicSpots.ts) com nome curto pros botões
const BEACHES = [
  { id: 'joaquina', name: 'Joaquina' },
  { id: 'mole', name: 'Praia Mole' },
  { id: 'campeche', name: 'Campeche' },
  { id: 'santinho', name: 'Santinho' },
]
const fmt = (h: number) => `${String(h).padStart(2, '0')}h`
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export function DayCurveDemo() {
  const { conditions } = useSurfData()
  // Abre na praia (dessas 4) que está melhor agora — cai na Joaquina enquanto carrega
  const initial = useMemo(() => {
    const ranked = BEACHES
      .map(b => ({ id: b.id, score: conditions.find(c => c.id === b.id)?.score ?? -1 }))
      .sort((a, b) => b.score - a.score)
    return ranked[0]?.score >= 0 ? ranked[0].id : 'joaquina'
  }, [conditions])
  const [picked, setPicked] = useState<string | null>(null)
  const beachId = picked ?? initial

  const [days, setDays] = useState<Record<string, DemoDay | 'error'>>({})
  const [selectedHour, setSelectedHour] = useState<number | null>(null)

  useEffect(() => {
    if (days[beachId]) return
    let cancelled = false
    fetch(`/api/landing-day?id=${beachId}`)
      .then(r => (r.ok ? r.json() as Promise<DemoDay> : Promise.reject()))
      .then(d => { if (!cancelled) setDays(prev => ({ ...prev, [beachId]: d })) })
      .catch(() => { if (!cancelled) setDays(prev => ({ ...prev, [beachId]: 'error' })) })
    return () => { cancelled = true }
  }, [beachId, days])

  const day = days[beachId]
  const data = day && day !== 'error' ? day : null

  const goodWin = useMemo(() => {
    if (!data) return null
    const gw = computeGoldenWindow(
      data.hours.map(h => ({ ...h, label: fmt(h.hour) })),
      data.best.hour, data.sunriseHour, data.sunsetHour
    )
    return gw ? { from: gw.startHour, to: gw.endHour } : null
  }, [data])

  const sel = data ? (data.hours.find(h => h.hour === (selectedHour ?? data.best.hour)) ?? data.best) : null
  const info = sel ? getRatingInfo(sel.score) : null
  const tideNow = data?.tideHeights && sel ? data.tideHeights[sel.hour] : undefined
  const tideNext = data?.tideHeights && sel ? data.tideHeights[sel.hour + 1] : undefined
  const tideTrend = tideNow === undefined || tideNext === undefined ? null
    : tideNext > tideNow + 0.02 ? 'enchendo' : tideNext < tideNow - 0.02 ? 'secando' : 'parada'
  const windDeg = sel ? WIND_DEG[sel.windDirection.toUpperCase()] : undefined
  const weekday = data ? WEEKDAYS[new Date(`${data.date}T12:00:00`).getDay()] : ''

  return (
    <div className="flex flex-col gap-5">
      {/* Escolha da praia */}
      <div className="-mx-5 overflow-x-auto px-5 scrollbar-none" role="tablist" aria-label="Escolha a praia">
        <div className="flex w-max gap-2">
          {BEACHES.map(b => {
            const active = b.id === beachId
            return (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => { setPicked(b.id); setSelectedHour(null) }}
                className={`h-9 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:border-primary/50'
                }`}
              >
                {b.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        {!day && (
          <div className="flex flex-col gap-3 p-4" aria-label="Carregando a previsão">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-10 w-28 animate-pulse rounded bg-muted" />
            <div className="h-40 w-full animate-pulse rounded-xl bg-muted" />
          </div>
        )}
        {day === 'error' && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Não deu pra carregar a previsão de amanhã agora. Tenta de novo em alguns minutos.
          </p>
        )}

        {data && sel && info && (
          <>
            <div className="flex items-end justify-between gap-3 px-4 pt-4">
              <div>
                <div className="text-xs text-muted-foreground">{data.beach.name} · amanhã, {weekday}</div>
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
        )}
      </div>

      <Link to="/login" onClick={() => countLandingCta('curva')} className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-primary hover:underline">
        Ver a previsão de todas as praias
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
