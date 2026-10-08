import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { DayCurveCard } from '@/components/spot/DayCurveCard'
import { useSurfData } from '@/contexts/SurfDataContext'
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
                onClick={() => setPicked(b.id)}
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

        {data && (
          <DayCurveCard key={beachId} data={data} caption={`${data.beach.name} · amanhã, ${weekday}`} />
        )}
      </div>

      <Link to="/login" onClick={() => countLandingCta('curva')} className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-primary hover:underline">
        Ver a previsão de todas as praias
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
