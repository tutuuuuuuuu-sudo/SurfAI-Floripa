import { useState, useEffect } from 'react'
import { X, Trophy, Medal } from 'lucide-react'
import { getSpotRanking, SpotRanking } from '@/lib/ranking'
import { useAuth } from '@/contexts/AuthContext'

const MEDAL_COLOR = ['text-yellow-500', 'text-zinc-400', 'text-amber-700']

export const RankingModal = ({ spotName, beachId, onClose }: { spotName: string; beachId: string; onClose: () => void }) => {
  const { user } = useAuth()
  const [ranking, setRanking] = useState<SpotRanking | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSpotRanking(beachId).then(r => { setRanking(r); setLoading(false) })
  }, [beachId])

  const userInTop10 = ranking?.currentUser && ranking.currentUser.position <= 10

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Ranking — {spotName}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        {ranking && (
          <p className="text-xs text-muted-foreground capitalize mb-5">Quem mais confirmou condições em {ranking.monthLabel}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : !ranking || ranking.entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Ninguém confirmou condições aqui este mês ainda.</p>
            <p className="text-xs mt-1">Seja o primeiro a votar em "Bateu?"</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {ranking.entries.map(entry => {
              const isMe = user && entry.userId === user.id
              return (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-3 p-2.5 rounded-xl ${isMe ? 'bg-primary/10 border border-primary/30' : 'bg-muted/20'}`}
                >
                  <div className="w-7 flex-shrink-0 flex items-center justify-center">
                    {entry.position <= 3
                      ? <Medal className={`h-5 w-5 ${MEDAL_COLOR[entry.position - 1]}`} />
                      : <span className="text-sm font-bold text-muted-foreground">{entry.position}</span>
                    }
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{entry.userName.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold truncate block">{isMe ? 'Você' : entry.userName}</span>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">{entry.count}x</span>
                </div>
              )
            })}

            {ranking.currentUser && !userInTop10 && (
              <>
                <div className="text-center text-xs text-muted-foreground py-1">···</div>
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-primary/10 border border-primary/30">
                  <div className="w-7 flex-shrink-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-muted-foreground">{ranking.currentUser.position}</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{ranking.currentUser.userName.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold">Você</span>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">{ranking.currentUser.count}x</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
