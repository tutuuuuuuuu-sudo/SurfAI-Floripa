import type { ReactNode } from 'react'

// Balão de mensagem do chat com o Surf AI (SurfChatPanel). Separado em 08/out/2026 pra página
// Premium mostrar a conversa de exemplo com o MESMO balão do chat de verdade.

export function ChatBubble({ role, children }: { role: 'user' | 'assistant'; children: ReactNode }) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
          role === 'user'
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-card border border-border/50 rounded-bl-sm'
        }`}
      >
        {children}
      </div>
    </div>
  )
}
