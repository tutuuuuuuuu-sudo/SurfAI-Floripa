import { useState } from 'react'
import { Star, Trash2, Share2, Waves, Wind, Clock, ArrowUpDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { formatDuration, type SurfSession } from '@/lib/sessions'
import { shareSessionCard } from '@/lib/sessionStoryCard'
import { formatWaveRange } from '@/lib/surfData'
import { getRatingInfo } from '@/lib/rating'
import { track } from '@/lib/monitoring'

export function SessionCard({ session: s, onDelete }: { session: SurfSession; onDelete: (id: string) => void }) {
  const [sharing, setSharing] = useState(false)
  const score = s.app_score != null ? getRatingInfo(s.app_score) : null
  const hasSea = s.wave_height != null || s.wind_speed != null || s.tide_trend

  async function share() {
    setSharing(true)
    const result = await shareSessionCard(s)
    setSharing(false)
    track('session_shared', { result, from: 'list' })
    if (result === 'downloaded') toast.success('Imagem baixada. É só postar no story!')
    if (result === 'failed') toast.error('Não deu pra gerar a imagem')
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">{s.beach_name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {new Date(`${s.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
            {s.start_hour != null && ` · ${s.start_hour}h`}
            {s.duration_minutes ? ` · ${formatDuration(s.duration_minutes)}` : ''}
          </div>
          {s.rating ? (
            <div className="flex gap-0.5 mt-1.5">
              {[1, 2, 3, 4, 5].map(i => <Star key={i} className={`h-3.5 w-3.5 ${i <= (s.rating ?? 0) ? 'text-rating-fair fill-rating-fair' : 'text-muted'}`} />)}
            </div>
          ) : null}
        </div>
        {score && s.app_score != null && (
          <div className="text-center flex-shrink-0">
            <div className={`text-xl font-bold leading-none ${score.color}`}>{s.app_score.toFixed(1)}</div>
            <div className="text-[10px] text-muted-foreground mt-1">nota do app</div>
          </div>
        )}
      </div>

      {hasSea && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/80 mt-3">
          {s.wave_height != null && <span className="flex items-center gap-1"><Waves className="h-3 w-3 text-primary" />{formatWaveRange(s.wave_height)}</span>}
          {s.wind_speed != null && <span className="flex items-center gap-1"><Wind className="h-3 w-3 text-primary" />{s.wind_direction} {s.wind_speed} km/h</span>}
          {s.swell_period != null && <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-primary" />{s.swell_period}s</span>}
          {s.tide_trend && <span className="flex items-center gap-1"><ArrowUpDown className="h-3 w-3 text-primary" />maré {s.tide_trend.replace(' (virando)', '')}</span>}
        </div>
      )}

      {s.notes && <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2 mt-3">{s.notes}</p>}

      <div className="flex items-center justify-end gap-1 mt-3 -mb-1">
        <button onClick={share} disabled={sharing}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary px-2.5 py-1.5 rounded-lg hover:bg-primary/10 transition-colors">
          {sharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}Story
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="p-1.5 text-muted-foreground hover:text-destructive transition-colors" aria-label="Remover sessão">
              <Trash2 className="h-4 w-4" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover esta sessão?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
