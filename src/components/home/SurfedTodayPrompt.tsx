import { useEffect, useState } from 'react'
import { BookOpen, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { todaySP, nowHourSP } from '@/lib/timeSP'
import { hasSessionOn } from '@/lib/sessions'
import { getRatingInfo } from '@/lib/rating'
import { SessionSheet } from '@/components/sessions/SessionSheet'

// "Caiu hoje?" (09/out/2026): depois de uma manhã de mar bom, a Home lembra de registrar a sessão,
// já com a praia, o dia e a hora preenchidos. Usa o histórico de hora em hora (score_snapshots):
// "tava 7.8" é o que o app mostrava naquela hora, não uma previsão. Prioriza as favoritas.
const MIN_SCORE = 6
const DISMISS_KEY = 'surfed_prompt_dismissed'

interface GoodHour { beachId: string; beachName: string; score: number; hour: number }

export function SurfedTodayPrompt({ favorites }: { favorites: string[] }) {
  const { user } = useAuth()
  const [best, setBest] = useState<GoodHour | null>(null)
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const today = todaySP()

  useEffect(() => {
    if (!user) return
    const nowHour = nowHourSP()
    if (nowHour < 9) return
    try { if (localStorage.getItem(DISMISS_KEY) === today) return } catch { /* segue */ }
    let cancelled = false
    ;(async () => {
      if (await hasSessionOn(user.id, today)) return
      // De 5h até 1 h atrás (quem caiu agora ainda está na água)
      const from = new Date(`${today}T05:00:00-03:00`).toISOString()
      const to = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('score_snapshots')
        .select('beach_id, beach_name, score, captured_at')
        .gte('captured_at', from).lte('captured_at', to)
        .gte('score', MIN_SCORE)
        .order('score', { ascending: false })
        .limit(50)
      if (cancelled || !data?.length) return
      const pick = data.find(r => favorites.includes(r.beach_id)) ?? data[0]
      const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date(pick.captured_at)))
      setBest({ beachId: pick.beach_id, beachName: pick.beach_name, score: Number(pick.score), hour })
    })()
    return () => { cancelled = true }
  }, [user, today, favorites.join()]) // eslint-disable-line react-hooks/exhaustive-deps

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, today) } catch { /* sem armazenamento, só some agora */ }
    setBest(null)
  }

  if (!best) return null
  const rating = getRatingInfo(best.score)
  return (
    <>
      {!done && <div className="relative rounded-2xl border border-primary/30 bg-card p-4 anim-slide">
        <button onClick={dismiss} className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground hover:bg-muted" aria-label="Agora não">
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="font-bold">Caiu hoje?</div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {best.beachName} tava <span className={`font-bold ${rating.color}`}>{best.score.toFixed(1)}</span> às {best.hour}h. Registra a sessão e o app guarda esse mar pra você.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button onClick={() => setOpen(true)} className="h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold active:scale-95 transition-all">
            Registrar
          </button>
          <button onClick={dismiss} className="h-10 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted/50">
            Não caí
          </button>
        </div>
      </div>}
      {open && (
        <SessionSheet
          source="home_prompt" initialBeachId={best.beachId} initialDate={today} initialHour={best.hour}
          onClose={() => { setOpen(false); if (done) setBest(null) }}
          onSaved={() => setDone(true)}
        />
      )}
    </>
  )
}
