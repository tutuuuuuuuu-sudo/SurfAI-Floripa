import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BeachCondition } from '@/lib/surfData'
import { useSurfData } from '@/contexts/SurfDataContext'
import { ArrowLeft, Plus, Crown, Lock } from 'lucide-react'
import { getScoreColor } from '@/lib/rating'
import { usePremium } from '@/lib/premium'
import { supabase } from '@/lib/supabase'
import { nowHourSP } from '@/lib/timeSP'
import { computeTrend, type Trend } from '@/lib/compareTrend'
import { CompareSpotCard } from '@/components/spot/CompareSpotCard'
import { CompareTable } from '@/components/spot/CompareTable'

const MAX_COMPARE = 3

export default function ComparePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { conditions, loading } = useSurfData()
  const { isPremium, status } = usePremium()
  const allSpots = [...conditions].sort((a, b) => b.score - a.score)
  const [selected, setSelected] = useState<BeachCondition[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')

  // Se veio de um card de praia específico (?spot=id), começa com ela + a melhor
  // colocada. Se vieram duas (?spot=id&spot2=id2, ex: do Bora Surfar comparando "mais
  // perto" com "vale o desvio"), começa com as duas exatas em vez de completar com a
  // melhor nota. Senão, inicializa com as 2 melhores do momento.
  useEffect(() => {
    if (allSpots.length > 0 && selected.length === 0) {
      const preselectedId = searchParams.get('spot')
      const preselectedId2 = searchParams.get('spot2')
      const preselected = preselectedId ? allSpots.find(s => s.id === preselectedId) : null
      const preselected2 = preselectedId2 ? allSpots.find(s => s.id === preselectedId2) : null
      if (preselected && preselected2) {
        setSelected([preselected, preselected2])
      } else if (preselected) {
        const runnerUp = allSpots.find(s => s.id !== preselected.id)
        setSelected(runnerUp ? [preselected, runnerUp] : [preselected])
      } else {
        setSelected(allSpots.slice(0, 2))
      }
    }
  }, [conditions]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tendência (melhorando/piorando/estável) de cada praia selecionada, calculada a
  // partir da previsão hora a hora — mesmo dado do card "Melhor Janela do Dia".
  const [trends, setTrends] = useState<Record<string, Trend>>({})

  useEffect(() => {
    let cancelled = false
    async function loadTrends() {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const nowHour = nowHourSP()
      await Promise.all(selected.map(async spot => {
        try {
          const res = await fetch(
            `/api/hourly?lat=${spot.lat}&lng=${spot.lng}&orientation=${spot._beachOrientation ?? 90}`,
            token ? { headers: { Authorization: `Bearer ${token}` } } : {}
          )
          if (!res.ok || cancelled) return
          const json = await res.json() as { slots: { hour: number; score: number }[] }
          const trend = computeTrend(json.slots, nowHour)
          if (trend && !cancelled) setTrends(prev => ({ ...prev, [spot.id]: trend }))
        } catch { /* silencioso — a linha de tendência só some pra essa praia */ }
      }))
    }
    if (selected.length >= 2) loadTrends()
    return () => { cancelled = true }
  }, [selected])

  const addSpot = (spot: BeachCondition) => {
    if (selected.find(s => s.id === spot.id)) return
    if (selected.length >= MAX_COMPARE) return
    setSelected(prev => [...prev, spot])
    setShowPicker(false)
    setSearch('')
  }

  const removeSpot = (id: string) => setSelected(prev => prev.filter(s => s.id !== id))

  const filtered = allSpots.filter(s =>
    !selected.find(sel => sel.id === s.id) &&
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  // "Comparação de picos" é benefício Premium (tabela de planos no CLAUDE.md) — antes
  // disso, o gate real era uma cota de "1 comparação grátis/dia" que não protegia nada
  // de verdade (o score de cada praia já é público pra conta free, praia por praia) e
  // era trivial de burlar limpando 2 chaves do navegador. Trocado por bloqueio direto:
  // free não compara, premium compara à vontade.
  if (status !== 'loading' && !isPremium) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-2">Comparar Praias é Premium</h2>
        <p className="text-muted-foreground text-sm mb-6 max-w-xs">
          Compare a nota, ondas e vento de até 3 praias ao mesmo tempo, sem limite.
        </p>
        <Button onClick={() => navigate('/premium')} className="gap-2">
          <Crown className="h-4 w-4" />Assinar Premium
        </Button>
        <Button variant="ghost" onClick={() => navigate('/')} className="mt-2">
          Voltar ao início
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar
          </Button>
          <h1 className="text-lg font-bold">Comparar Praias</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-5">

        {/* Praias selecionadas */}
        <div className={`grid gap-3 ${selected.length === 3 ? 'grid-cols-3' : selected.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {selected.map((spot, idx) => (
            <CompareSpotCard key={spot.id} index={idx} score={spot.score} name={spot.name} region={spot.region} onRemove={() => removeSpot(spot.id)} />
          ))}

          {/* Botão adicionar */}
          {selected.length < MAX_COMPARE && (
            <button
              onClick={() => { setShowPicker(true) }}
              className="border-2 border-dashed border-border/50 hover:border-primary/40 rounded-xl p-6 flex flex-col items-center justify-center gap-2 transition-colors hover:bg-primary/5"
              style={{ animation: `fadeIn 0.3s ${selected.length * 0.1}s ease-out both`, minHeight: '120px' }}
            >
              <Plus className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Adicionar praia</span>
            </button>
          )}
        </div>

        {/* Picker de praias */}
        {showPicker && (
          <Card style={{ animation: 'slideUp 0.3s ease-out' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Escolha uma praia para comparar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar praia..."
                className="w-full text-sm px-3 py-2 rounded-xl border border-border bg-muted/20 outline-none focus:border-primary transition-colors"
                autoFocus
              />
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {filtered.map(spot => {
                  const color = getScoreColor(spot.score)
                  return (
                    <button
                      key={spot.id}
                      onClick={() => addSpot(spot)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: color }}>
                        {spot.score.toFixed(1)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{spot.name}</div>
                        <div className="text-xs text-muted-foreground">{spot.region} · {spot.waveHeight.toFixed(1)}m</div>
                      </div>
                    </button>
                  )
                })}
              </div>
              <button onClick={() => { setShowPicker(false); setSearch('') }} className="w-full text-xs text-muted-foreground hover:text-foreground py-1">
                Cancelar
              </button>
            </CardContent>
          </Card>
        )}

        {/* Tabela comparativa */}
        {selected.length >= 2 && !loading && (
          <CompareTable
            spots={selected.map(s => ({ id: s.id, score: s.score, waveHeight: s.waveHeight, swellPeriod: s.swellPeriod, windSpeed: s.windSpeed, waterTemp: s.waterConditions.temperature }))}
            trends={trends}
          />
        )}

        {/* Links para detalhes */}
        {selected.length >= 1 && (
          <div className={`grid gap-3 ${selected.length === 3 ? 'grid-cols-3' : selected.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {selected.map(spot => (
              <Button key={spot.id} variant="outline" size="sm" onClick={() => navigate(`/spot/${spot.id}`)}>
                Ver {spot.name}
              </Button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
