import { useState, useEffect, useRef } from 'react'
import { X, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Progress } from '@/components/ui/progress'
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock'
import { sendChatMessage, loadChatHistory, getChatUsage, ChatUsage } from '@/lib/surfChat'
import { BeachCondition } from '@/lib/surfData'
import { track } from '@/lib/monitoring'

// Abaixo desse tanto de mensagens restando, a barra vira aviso mais direto ("só mais X
// mensagens hoje") em vez do texto neutro de contagem.
const LOW_REMAINING_THRESHOLD = 5

interface Props {
  open: boolean
  onClose: () => void
  spots: BeachCondition[]
  userLevel?: string
  userName: string
}

interface LocalMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export function SurfChatPanel({ open, onClose, spots, userLevel, userName }: Props) {
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usage, setUsage] = useState<ChatUsage | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useBodyScrollLock(open)

  // Carrega o histórico salvo e a cota de mensagens do dia só na primeira vez que o chat é
  // aberto na sessão — a cota é lida sem gastar mensagem (api/chat-usage.ts), pra barra já
  // aparecer certa antes do usuário mandar qualquer coisa.
  useEffect(() => {
    if (!open || historyLoaded) return
    loadChatHistory().then(history => {
      setMessages(history.map(h => ({ id: h.id, role: h.role, content: h.content })))
      setHistoryLoaded(true)
    })
    getChatUsage().then(u => { if (u) setUsage(u) })
  }, [open, historyLoaded])

  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, sending])

  if (!open) return null

  const limitReached = usage != null && usage.remaining <= 0

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending || limitReached) return
    setInput('')
    setError(null)
    setMessages(prev => [...prev, { id: `local-${Date.now()}-u`, role: 'user', content: text }])
    setSending(true)
    track('surf_chat_message_sent')

    const result = await sendChatMessage(text, spots, userLevel)
    setSending(false)
    if (result.usage) setUsage(result.usage)

    if (!result.ok) {
      setError(result.error)
      return
    }
    setMessages(prev => [...prev, { id: `local-${Date.now()}-a`, role: 'assistant', content: result.reply }])
  }

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col" style={{ animation: 'slideUpSheet 0.3s ease-out' }}>
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-card/80 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm leading-tight">Chat com o Surf AI</div>
            <div className="text-xs text-muted-foreground truncate">Pergunte sobre as condições ou qualquer praia</div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors flex-shrink-0" title="Fechar">
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </header>

      {usage && (
        <div className="px-4 py-2 border-b border-border/40 bg-card/80 backdrop-blur-md flex-shrink-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className={`text-xs ${usage.remaining <= LOW_REMAINING_THRESHOLD ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
              {usage.remaining <= 0
                ? 'Limite diário atingido'
                : usage.remaining <= LOW_REMAINING_THRESHOLD
                  ? `Você ainda tem ${usage.remaining} mensage${usage.remaining === 1 ? 'm' : 'ns'} hoje`
                  : `${usage.used} de ${usage.max} mensagens hoje`}
            </span>
          </div>
          <Progress value={Math.min(100, (usage.used / usage.max) * 100)} className="h-1" />
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {!historyLoaded && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Spinner className="size-3.5 text-primary" />Carregando conversa...
          </div>
        )}

        {historyLoaded && messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8 px-4">
            Oi, {userName}! Pergunta o que quiser sobre as condições de hoje, qual praia ir, ou qualquer coisa sobre surf em Floripa.
          </div>
        )}

        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-card border border-border/50 rounded-bl-sm'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-card border border-border/50 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2">
              <Spinner className="size-3.5 text-primary" />
              <span className="text-xs text-muted-foreground animate-pulse">Pensando...</span>
            </div>
          </div>
        )}

        {error && <div className="text-center text-xs text-destructive py-2">{error}</div>}
      </div>

      <div className="border-t border-border/40 bg-card/80 backdrop-blur-md px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder={limitReached ? 'Limite diário atingido — volta amanhã' : 'Pergunte sobre o surf hoje...'}
            disabled={sending || limitReached}
            className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
          />
          <Button size="icon" className="rounded-full flex-shrink-0" onClick={handleSend} disabled={sending || limitReached || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
