import { useState } from 'react'
import { useReveal } from '@/hooks/use-reveal'
import { ChevronDown } from 'lucide-react'
import { getRatingInfo } from '@/lib/rating'

// ── Reveal wrapper ───────────────────────────────────────────────────────────

export function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal()
  return (
    <div ref={ref} className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
      }}>
      {children}
    </div>
  )
}

// ── FAQ Item ──────────────────────────────────────────────────────────────────

export function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: 'color-mix(in oklch, var(--foreground) 2%, transparent)',
        border: '1px solid color-mix(in oklch, var(--foreground) 7%, transparent)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 2px 16px oklch(0 0 0 / 0.1), inset 0 1px 0 color-mix(in oklch, var(--foreground) 5%, transparent)',
      }}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-card/60 transition-colors"
        aria-expanded={open}>
        <span className="text-sm font-semibold pr-4">{q}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-all duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border/30 pt-4">{a}</div>
        </div>
      </div>
    </div>
  )
}

// ── Mockup: Bora Surfar ──────────────────────────────────────────────────────
// Reproduz o layout real de GeoFinderCard.tsx (Mais perto vs Vale o desvio) com
// dado estático só pra ilustrar a decisão.

export function GeoFinderMockup() {
  // Rótulo e cor vêm de getRatingInfo() — fonte única do app. Antes estavam
  // escritos à mão aqui e ficaram errados quando as faixas de nota mudaram.
  const near = getRatingInfo(5.8)
  const far = getRatingInfo(8.3)
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-xl border border-border/40 p-3 text-left">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Mais perto</div>
        <div className="text-sm font-semibold leading-tight">Campeche</div>
        <div className="text-xs text-muted-foreground mt-0.5">1.2km de você</div>
        <div className={`text-base font-bold mt-1.5 ${near.color}`}>5.8 <span className="text-[10px] font-bold">{near.label}</span></div>
      </div>
      <div className="rounded-xl border-2 border-primary/50 bg-primary/5 p-3 text-left">
        <div className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1.5">Vale o desvio</div>
        <div className="text-sm font-semibold leading-tight">Matadeiro</div>
        <div className="text-xs text-muted-foreground mt-0.5">6.2km de você</div>
        <div className={`text-base font-bold mt-1.5 ${far.color}`}>8.3 <span className="text-[10px] font-bold">{far.label}</span></div>
      </div>
    </div>
  )
}
