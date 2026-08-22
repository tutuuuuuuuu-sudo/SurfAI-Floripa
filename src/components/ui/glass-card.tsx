import * as React from "react"

import { cn } from "@/lib/utils"

// Pensado pra ficar sobre foto/vídeo de fundo, fora do sistema de tema normal —
// mesma exceção já documentada no CLAUDE.md pra Landing.tsx (cores fixas em vez de
// classes de tema, porque o contraste tem que valer sobre a foto, não sobre o
// background do app, independente de light/dark mode escolhido pelo usuário).
function GlassCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="glass-card"
      className={cn(
        "flex flex-col gap-6 rounded-2xl border border-white/20 bg-white/10 py-6 text-white shadow-2xl backdrop-blur-xl",
        className,
      )}
      {...props}
    />
  )
}

function GlassCardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="glass-card-header"
      className={cn("flex flex-col items-center gap-2 px-6 text-center", className)}
      {...props}
    />
  )
}

function GlassCardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="glass-card-title" className={cn("text-xl font-bold leading-none", className)} {...props} />
  )
}

function GlassCardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="glass-card-description" className={cn("text-sm text-white/70", className)} {...props} />
  )
}

function GlassCardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="glass-card-content" className={cn("px-6", className)} {...props} />
}

function GlassCardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="glass-card-footer" className={cn("flex flex-col gap-3 px-6", className)} {...props} />
}

export {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
  GlassCardFooter,
}
