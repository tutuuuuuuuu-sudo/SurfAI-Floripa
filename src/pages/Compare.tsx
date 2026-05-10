import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { fetchCurrentConditions, BeachCondition } from '@/lib/surfData'
import { ArrowLeft, Waves, Wind, Thermometer, X, Plus, TrendingUp } from 'lucide-react'
import { getScoreColor, getRatingInfo } from '@/lib/rating'

const getScoreLabel = (score: number) => getRatingInfo(score).label.charAt(0) + getRatingInfo(score).label.slice(1).toLowerCase()

const MAX_COMPARE = 3

export default function ComparePage() {
  const navigate = useNavigate()
  const [allSpots, setAllSpots] = useState<BeachCondition[]>([])
  const [selected, setSelected] = useState<BeachCondition[]>([])
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchCurrentConditions().then(spots => {
      setAllSpots(spots.sort((a, b) => b.score - a.score))
      // Começa com as 2 melhores praias selecionadas
      setSelected(spots.sort((a, b) => b.score - a.score).slice(0, 2))
      setLoading(false)
    })
  }, [])

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

  const metrics = [
    { key: 'score', label: 'Score IA', icon: TrendingUp, format: (v: number) => v.toFixed(1), higher: true },
    { key: 'waveHeight', label: 'Altura das Ondas', icon: Waves, format: (v: number) => `${v.toFixed(1)}m`, higher: true },
    { key: 'swellPeriod', label: 'Período', icon: Waves, format: (v: number) => `${Math.round(v)}s`, higher: true },
    { key: 'windSpeed', label: 'Vento', icon: Wind, format: (v: number) => `${Math.round(v)}km/h`, higher: false },
    { key: 'waterTemp', label: 'Água', icon: Thermometer, format: (v: number) => `${v}°C`, higher: true },
  ]

  const getValue = (spot: BeachCondition, key: string): number => {
    if (key === 'waterTemp') return spot.waterConditions.temperature
    return (spot as any)[key] ?? 0
  }

  const getBest = (key: string, higher: boolean): string => {
    if (selected.length < 2) return ''
    const vals = selected.map(s => ({ id: s.id, val: getValue(s, key) }))
    const best = higher
      ? vals.reduce((a, b) => b.val > a.val ? b : a)
      : vals.reduce((a, b) => b.val < a.val ? b : a)
    // Só destaca se houver diferença
    const allSame = vals.every(v => v.val === vals[0].val)
    return allSame ? '' : best.id
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
          {selected.map((spot, idx) => {
            const color = getScoreColor(spot.score)
            return (
              <Card key={spot.id} className="relative overflow-hidden" style={{ animation: `slideUp 0.3s ${idx * 0.1}s ease-out both` }}>
                <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: color }} />
                <CardContent className="pt-5 pb-4 text-center">
                  <button
                    onClick={() => removeSpot(spot.id)}
                    className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted/50 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <div className="text-3xl font-bold mb-0.5" style={{ color }}>{spot.score.toFixed(1)}</div>
                  <div className="text-xs font-bold mb-2" style={{ color }}>{getScoreLabel(spot.score)}</div>
                  <div className="font-semibold text-sm leading-tight">{spot.name}</div>
                  <div className="text-xs text-muted-foreground">{spot.region}</div>
                </CardContent>
              </Card>
            )
          })}

          {/* Botão adicionar */}
          {selected.length < MAX_COMPARE && (
            <button
              onClick={() => setShowPicker(true)}
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
          <Card style={{ animation: 'slideUp 0.4s ease-out' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Comparativo Detalhado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {metrics.map((metric, mIdx) => {
                const bestId = getBest(metric.key, metric.higher)
                return (
                  <div key={metric.key} className={`grid gap-2 py-3 ${selected.length === 3 ? 'grid-cols-4' : 'grid-cols-3'} ${mIdx !== 0 ? 'border-t' : ''}`}>
                    <div className="flex items-center gap-1.5">
                      <metric.icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">{metric.label}</span>
                    </div>
                    {selected.map(spot => {
                      const val = getValue(spot, metric.key)
                      const isBest = spot.id === bestId
                      return (
                        <div key={spot.id} className={`text-center rounded-lg py-1.5 ${isBest ? 'bg-primary/10' : ''}`}>
                          <div className={`text-sm font-bold ${isBest ? 'text-primary' : ''}`}>
                            {metric.format(val)}
                          </div>
                          {isBest && <div className="text-xs text-primary">✓ melhor</div>}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </CardContent>
          </Card>
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
