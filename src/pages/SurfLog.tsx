import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getRatingInfo } from '@/lib/rating'
import { useSurfData } from '@/contexts/SurfDataContext'
import {
  ArrowLeft, Waves, Plus, Clock, Star, Trash2, X,
  CalendarDays, MapPin, FileText
} from 'lucide-react'
import { toast } from 'sonner'

interface SurfSession {
  id: string
  beach_id: string
  beach_name: string
  date: string
  duration_minutes: number | null
  rating: number | null
  notes: string | null
  created_at: string
}

const FALLBACK_BEACHES = [
  'Campeche', 'Novo Campeche', 'Morro das Pedras', 'Matadeiro',
  'Lagoinha do Leste', 'Açores', 'Solidão', 'Armação', 'Naufragados',
  'Joaquina', 'Praia Mole', 'Moçambique', 'Barra da Lagoa',
  'Santinho', 'Ponta das Aranhas',
]

function getBeachesList(conditions: { name: string }[]): string[] {
  if (conditions.length > 0) return conditions.map(s => s.name).sort()
  return FALLBACK_BEACHES
}

const STAR_LABELS = ['', 'Ruim', 'Regular', 'Bom', 'Excelente', 'Épico']

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="p-0.5"
        >
          <Star
            className={`h-7 w-7 transition-colors ${
              i <= (hover || value) ? 'text-yellow-400 fill-yellow-400' : 'text-muted'
            }`}
          />
        </button>
      ))}
      {(hover || value) > 0 && (
        <span className="text-sm text-muted-foreground ml-1">{STAR_LABELS[hover || value]}</span>
      )}
    </div>
  )
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function SurfLog() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { conditions } = useSurfData()
  const [sessions, setSessions] = useState<SurfSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [tableError, setTableError] = useState(false)

  // Form state
  const [beach, setBeach] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [hours, setHours] = useState(1)
  const [mins, setMins] = useState(30)
  const [rating, setRating] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadSessions() }, [user])

  async function loadSessions() {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('surf_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(50)

    if (error) {
      if (error.code === '42P01') setTableError(true) // table does not exist
      else setTableError(true)
    } else {
      setSessions(data ?? [])
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!user) return
    if (!beach) { toast.error('Escolha uma praia'); return }
    if (!date) { toast.error('Escolha uma data'); return }
    setSaving(true)

    const duration = hours * 60 + mins
    const { error } = await supabase.from('surf_sessions').insert({
      user_id: user.id,
      beach_id: beach.toLowerCase().replace(/\s+/g, '-'),
      beach_name: beach,
      date,
      duration_minutes: duration || null,
      rating: rating || null,
      notes: notes.trim() || null,
    })

    if (error) {
      toast.error('Erro ao salvar sessão')
    } else {
      toast.success('Sessão registrada!')
      setShowForm(false)
      setBeach(''); setRating(0); setNotes(''); setHours(1); setMins(30)
      loadSessions()
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta sessão? Esta ação não pode ser desfeita.')) return
    if (!user) return
    const { error } = await supabase
      .from('surf_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) { toast.error('Erro ao deletar'); return }
    toast.success('Sessão removida')
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  const totalMinutes = sessions.reduce((acc, s) => acc + (s.duration_minutes ?? 0), 0)
  const avgRating = sessions.filter(s => s.rating).reduce((acc, s, _, arr) => acc + (s.rating ?? 0) / arr.length, 0)

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Waves className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Minhas Sessões</h1>
                <p className="text-xs text-muted-foreground">Histórico de surf</p>
              </div>
            </div>
          </div>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Registrar
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-5 max-w-lg">

        {/* Aviso de tabela não criada */}
        {tableError && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold">Log de sessões temporariamente indisponível</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Não foi possível acessar seus registros. Tente novamente em breve.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Formulário */}
        {showForm && (
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Nova sessão</CardTitle>
                <button onClick={() => setShowForm(false)}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Praia</label>
                <select
                  value={beach}
                  onChange={e => setBeach(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">Selecionar praia...</option>
                  {getBeachesList(conditions).map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Data</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Duração</label>
                <div className="flex items-center gap-2">
                  <select value={hours} onChange={e => setHours(Number(e.target.value))}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary">
                    {[0,1,2,3,4].map(h => <option key={h} value={h}>{h}h</option>)}
                  </select>
                  <select value={mins} onChange={e => setMins(Number(e.target.value))}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary">
                    {[0,15,30,45].map(m => <option key={m} value={m}>{m}min</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Como estava?</label>
                <StarRating value={rating} onChange={setRating} />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Notas (opcional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Como foi a sessão? Algum detalhe especial?"
                  rows={3}
                  maxLength={300}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
                />
                <div className="text-xs text-muted-foreground text-right mt-0.5">{notes.length}/300</div>
              </div>

              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar sessão'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Estatísticas */}
        {sessions.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="py-3 text-center">
                <div className="text-2xl font-bold text-primary">{sessions.length}</div>
                <div className="text-xs text-muted-foreground">Sessões</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 text-center">
                <div className="text-2xl font-bold text-primary">
                  {Math.round(totalMinutes / 60)}h
                </div>
                <div className="text-xs text-muted-foreground">No mar</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 text-center">
                <div className="text-2xl font-bold text-yellow-400">
                  {avgRating > 0 ? avgRating.toFixed(1) : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Média</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
        ) : sessions.length === 0 && !tableError ? (
          <div className="text-center py-16 space-y-3">
            <Waves className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">Nenhuma sessão registrada ainda.</p>
            <p className="text-muted-foreground text-xs">Clique em "Registrar" para começar!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(session => {
              const ratingInfo = session.rating ? getRatingInfo(session.rating * 2) : null
              return (
                <Card key={session.id} className="border-border/50">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{session.beach_name}</span>
                          {session.rating && (
                            <Badge variant="outline" className={`text-xs ${ratingInfo?.color}`}>
                              {STAR_LABELS[session.rating]} ({session.rating}/5)
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {formatDate(session.date)}
                          </span>
                          {session.duration_minutes && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(session.duration_minutes)}
                            </span>
                          )}
                        </div>
                        {session.rating && (
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(i => (
                              <Star key={i} className={`h-3.5 w-3.5 ${i <= (session.rating ?? 0) ? 'text-yellow-400 fill-yellow-400' : 'text-muted'}`} />
                            ))}
                          </div>
                        )}
                        {session.notes && (
                          <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2">{session.notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(session.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Dica no final */}
        {sessions.length > 0 && (
          <div className="text-center pb-6">
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              <MapPin className="h-4 w-4 mr-2" />
              Ver condições agora
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
