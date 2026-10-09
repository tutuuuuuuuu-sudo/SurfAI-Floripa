import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { usePremium } from '@/lib/premium'
import { todaySP } from '@/lib/timeSP'
import { loadSessions, deleteSession, type SurfSession } from '@/lib/sessions'
import { SessionSheet } from '@/components/sessions/SessionSheet'
import { SessionCard } from '@/components/sessions/SessionCard'
import { IdealSeaCard } from '@/components/sessions/IdealSeaCard'
import { SessionStatsRow, IslandPassport, YearRecap } from '@/components/sessions/SessionAchievements'
import { Waves, Plus, FileText, Sparkles, Share2, Stamp, MapPin, Crown } from 'lucide-react'
import { toast } from 'sonner'

// Diário de sessões (redesenhado em 09/out/2026). Em toda a história só 1 sessão tinha sido
// registrada: o formulário dava trabalho e não devolvia nada. Agora registrar leva poucos toques
// (SessionSheet), o app guarda o mar daquela hora e devolve: "seu mar ideal" (Premium),
// conquistas (mês, semanas seguidas, passaporte da ilha, retrospectiva) e o cartão pro story.
export default function SurfLog() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isPremium } = usePremium()
  const [sessions, setSessions] = useState<SurfSession[]>([])
  const [loading, setLoading] = useState(true)
  const [tableError, setTableError] = useState(false)
  const [showSheet, setShowSheet] = useState(false)
  const today = todaySP()

  useEffect(() => {
    if (!user) return
    let cancelled = false
    loadSessions(user.id).then(data => {
      // Se o usuário mudou (logout/login rápido) entre o disparo e a resposta, ignora
      if (cancelled) return
      if (data === null) setTableError(true)
      else setSessions(data)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [user])

  async function handleDelete(id: string) {
    if (!user) return
    if (!(await deleteSession(user.id, id))) { toast.error('Erro ao remover'); return }
    toast.success('Sessão removida')
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  function handleSaved(s: SurfSession) {
    setSessions(prev => [s, ...prev].sort((a, b) => b.date.localeCompare(a.date) || (b.start_hour ?? 0) - (a.start_hour ?? 0)))
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-3 max-w-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Waves className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Minhas Sessões</h1>
              <p className="text-xs text-muted-foreground">Seu diário de surf</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setShowSheet(true)}>
            <Plus className="h-4 w-4 mr-1" />Registrar
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 pb-28 space-y-4 max-w-lg">
        {tableError && (
          <div className="rounded-2xl border border-rating-fair/30 bg-rating-fair/5 p-4 flex items-start gap-3">
            <FileText className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold">Sessões temporariamente indisponíveis</div>
              <div className="text-xs text-muted-foreground mt-1">Não foi possível acessar seus registros. Tente novamente em breve.</div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
        ) : sessions.length === 0 && !tableError ? (
          <>
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
              <div>
                <h2 className="text-lg font-bold">Caiu na água? Registra em 3 toques</h2>
                <p className="text-sm text-muted-foreground mt-1">Praia, hora e estrelas. O resto o app faz:</p>
              </div>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-start gap-2.5"><MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />Guarda como estava o mar na hora que você entrou</div>
                <div className="flex items-start gap-2.5"><Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" /><span>Aprende o seu mar ideal e avisa quando ele volta{!isPremium && <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-semibold text-rating-fair align-middle"><Crown className="h-3 w-3" />Premium</span>}</span></div>
                <div className="flex items-start gap-2.5"><Stamp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />Carimba o seu passaporte das 14 praias da ilha</div>
                <div className="flex items-start gap-2.5"><Share2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />Monta o cartão da sessão pra postar no story</div>
              </div>
              <Button className="w-full h-11" onClick={() => setShowSheet(true)}>
                <Plus className="h-4 w-4 mr-1.5" />Registrar minha primeira sessão
              </Button>
            </div>
            <IslandPassport sessions={sessions} />
          </>
        ) : (
          <>
            <SessionStatsRow sessions={sessions} today={today} />
            <IdealSeaCard sessions={sessions} isPremium={isPremium} />
            <IslandPassport sessions={sessions} />
            <YearRecap sessions={sessions} year={today.slice(0, 4)} />
            <div className="pt-2">
              <h2 className="text-sm font-bold mb-2">Sessões</h2>
              <div className="space-y-3">
                {sessions.map(s => <SessionCard key={s.id} session={s} onDelete={handleDelete} />)}
              </div>
            </div>
            <div className="text-center pt-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                <MapPin className="h-4 w-4 mr-2" />Ver condições agora
              </Button>
            </div>
          </>
        )}
      </main>

      {showSheet && <SessionSheet source="sessions" onClose={() => setShowSheet(false)} onSaved={handleSaved} />}
    </div>
  )
}
