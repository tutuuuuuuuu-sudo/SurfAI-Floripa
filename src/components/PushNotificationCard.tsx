import type { ReactNode } from 'react'
import { AppLogo } from '@/components/AppLogo'

// Desenho do alerta do Surf AI chegando no celular. Usado na landing (PremiumMorning, com o mar
// de agora) e na página Premium (exemplo). Sem título = carregando.

export function PushNotificationCard({ time, title, body }: { time: string; title?: ReactNode; body?: ReactNode }) {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/90 p-3.5 shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <AppLogo size={18} variant="icon" />
        <span className="font-semibold uppercase tracking-wide">Surf AI</span>
        <span className="ml-auto">{time}</span>
      </div>
      {title ? (
        <>
          <div className="mt-1.5 text-sm font-bold">{title}</div>
          <div className="text-sm leading-snug text-muted-foreground">{body}</div>
        </>
      ) : (
        <div className="mt-2 h-10 animate-pulse rounded bg-muted" />
      )}
    </div>
  )
}
