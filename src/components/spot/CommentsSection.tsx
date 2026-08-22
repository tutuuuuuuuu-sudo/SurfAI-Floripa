import { useState, useEffect } from 'react'
import { MessageCircle, Send, Trash2, Waves } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { getComments, addComment, deleteComment, formatCommentTime, Comment } from '@/lib/comments'
import { supabase } from '@/lib/supabase'
import { BeachCondition } from '@/lib/surfData'

export const CommentsSection = ({ spot }: { spot: BeachCondition }) => {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string|null>(null)

  useEffect(() => {
    loadComments()
    supabase.auth.getUser().then(({data}) => setCurrentUserId(data.user?.id ?? null))
  }, [spot.id])

  const loadComments = async () => {
    setLoading(true)
    setComments(await getComments(spot.id))
    setLoading(false)
  }

  const handleSubmit = async () => {
    if (!newComment.trim() || !currentUserId) return
    setSubmitting(true)
    const success = await addComment(spot.id, spot.name, newComment.trim(), spot.waveHeight, spot.score)
    if (success) { setNewComment(''); toast.success('Comentário adicionado!'); await loadComments() }
    else toast.error('Erro ao adicionar comentário.')
    setSubmitting(false)
  }

  const handleDelete = async (commentId: string) => {
    if (await deleteComment(commentId)) {
      setComments(prev => prev.filter(c => c.id !== commentId))
      toast.success('Comentário removido.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <MessageCircle className="h-5 w-5 text-primary"/>
        <span className="font-semibold text-base">Relatos do Dia</span>
        {comments.length > 0 && <Badge variant="secondary" className="text-xs">{comments.length}</Badge>}
      </div>
      {currentUserId ? (
        <div className="flex gap-2">
          <input
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
            placeholder="Como está o mar agora?"
            className="flex-1 text-sm px-3 py-2.5 rounded-xl border border-border bg-muted/20 outline-none focus:border-primary transition-colors"
            maxLength={280}
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !newComment.trim()}
            className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Send className="h-4 w-4"/>
          </button>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground bg-muted/20 rounded-xl p-3 text-center">Faça login para deixar um relato</div>
      )}
      {loading
        ? <div className="flex justify-center py-4"><Waves className="h-5 w-5 text-primary animate-bounce"/></div>
        : comments.length === 0
        ? (
          <div className="text-center py-6 text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-20"/>
            <p className="text-xs">Nenhum relato ainda. Seja o primeiro!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment, idx) => (
              <div key={comment.id} className="flex gap-3 p-3 bg-muted/20 rounded-xl" style={{animation:`slideInLeft 0.3s ${idx*0.05}s ease-out both`}}>
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary">{comment.user_name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold">{comment.user_name}</span>
                    {comment.wave_height && <span className="text-xs text-muted-foreground">· {Number(comment.wave_height).toFixed(1)}m</span>}
                    <span className="text-xs text-muted-foreground ml-auto">{formatCommentTime(comment.created_at)}</span>
                  </div>
                  <p className="text-sm break-words">{comment.content}</p>
                </div>
                {currentUserId === comment.user_id && (
                  <button onClick={() => handleDelete(comment.id)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                    <Trash2 className="h-3.5 w-3.5"/>
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}
