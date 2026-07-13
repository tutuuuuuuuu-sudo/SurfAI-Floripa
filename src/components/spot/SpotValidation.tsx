import { useState, useEffect } from 'react'
import { ThumbsUp, ThumbsDown, Waves, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { submitValidation, getValidationSummary, ValidationSummary } from '@/lib/validations'
import { useAuth } from '@/contexts/AuthContext'
import { BeachCondition } from '@/lib/surfData'
import { RankingModal } from './RankingModal'

export const SpotValidation = ({ spot }: { spot: BeachCondition }) => {
  const { user } = useAuth()
  const [summary, setSummary] = useState<ValidationSummary>({ matched: 0, total: 0, userVote: null })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showRanking, setShowRanking] = useState(false)

  useEffect(() => {
    getValidationSummary(spot.id).then(s => { setSummary(s); setLoading(false) })
  }, [spot.id])

  const handleVote = async (matched: boolean) => {
    if (!user) { toast.error('Faça login para confirmar as condições'); return }
    setSubmitting(true)
    const ok = await submitValidation(spot.id, spot.name, matched)
    if (ok) {
      setSummary(prev => {
        const hadVote = prev.userVote !== null
        const wasMatched = prev.userVote === true
        let matchedCount = prev.matched
        let total = prev.total
        if (!hadVote) { total += 1; if (matched) matchedCount += 1 }
        else if (wasMatched !== matched) { matchedCount += matched ? 1 : -1 }
        return { matched: matchedCount, total, userVote: matched }
      })
      toast.success(matched ? 'Valeu! Confirmado que bateu 🤙' : 'Anotado — obrigado pelo feedback')
    } else {
      toast.error('Erro ao registrar. Tente novamente.')
    }
    setSubmitting(false)
  }

  const pct = summary.total > 0 ? Math.round((summary.matched / summary.total) * 100) : null

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Waves className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-sm font-semibold">Bateu hoje em {spot.name}?</span>
        </div>
        {!loading && summary.total > 0 && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {summary.matched}/{summary.total} confirmaram
          </span>
        )}
      </div>

      {!loading && pct !== null && (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-rating-good transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => handleVote(true)}
          disabled={submitting}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-50 ${
            summary.userVote === true
              ? 'bg-rating-good/20 border-rating-good/50 text-rating-good'
              : 'border-border hover:bg-muted/40'
          }`}
        >
          <ThumbsUp className="h-4 w-4" />Bateu
        </button>
        <button
          onClick={() => handleVote(false)}
          disabled={submitting}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-50 ${
            summary.userVote === false
              ? 'bg-destructive/15 border-destructive/40 text-destructive'
              : 'border-border hover:bg-muted/40'
          }`}
        >
          <ThumbsDown className="h-4 w-4" />Não bateu
        </button>
      </div>

      {summary.total === 0 && !loading && (
        <p className="text-xs text-muted-foreground text-center">Seja o primeiro a confirmar as condições hoje</p>
      )}

      <button
        onClick={() => setShowRanking(true)}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:underline pt-1"
      >
        <Trophy className="h-3.5 w-3.5" />Ver ranking do mês
      </button>

      {showRanking && (
        <RankingModal spotName={spot.name} beachId={spot.id} onClose={() => setShowRanking(false)} />
      )}
    </div>
  )
}
