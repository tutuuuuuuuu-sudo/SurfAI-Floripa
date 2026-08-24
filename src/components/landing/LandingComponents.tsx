import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Crown, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ── Hook: animação de entrada no scroll ─────────────────────────────────────

export function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold])
  return { ref, visible }
}

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

// ── Número animado ────────────────────────────────────────────────────────────

export function AnimatedNumber({ value, suffix }: { value: number; suffix: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const steps = 40
        const increment = value / steps
        let current = 0
        timer = setInterval(() => {
          current += increment
          if (current >= value) { setCount(value); clearInterval(timer) }
          else setCount(Math.floor(current))
        }, 1200 / steps)
      }
    }, { threshold: 0.5 })
    if (ref.current) observer.observe(ref.current)
    return () => { observer.disconnect(); if (timer) clearInterval(timer) }
  }, [value])
  return <div ref={ref} className="text-4xl md:text-5xl font-black text-primary">{count}{suffix}</div>
}

// ── FAQ Item ──────────────────────────────────────────────────────────────────

export function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: 'oklch(1 0 0 / 0.02)',
        border: '1px solid oklch(1 0 0 / 0.07)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 2px 16px oklch(0 0 0 / 0.1), inset 0 1px 0 oklch(1 0 0 / 0.05)',
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

// ── Mockup: Chat com o Surf AI ───────────────────────────────────────────────
// Ilustrativo, sem dado real nem chamada de API — só pra dar a sensação de como o
// chat responde de verdade (mesmo padrão de bolha do SurfChatPanel.tsx).

export function ChatPreviewMockup() {
  return (
    <div className="rounded-2xl p-4 space-y-2.5"
      style={{ background: 'oklch(1 0 0 / 0.03)', border: '1px solid oklch(1 0 0 / 0.08)' }}>
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2 text-xs font-medium bg-primary text-primary-foreground">
          e a Joaquina, tá surfável?
        </div>
      </div>
      <div className="flex justify-start">
        <div className="max-w-[90%] rounded-2xl rounded-bl-sm px-3.5 py-2 text-xs leading-relaxed bg-card border border-border/50">
          Tá com 1.4m e período de 9s — boa pra intermediário. Vento ainda calmo, deve piorar depois do meio-dia.
        </div>
      </div>
    </div>
  )
}

// ── Mockup: Bora Surfar ──────────────────────────────────────────────────────
// Reproduz o layout real de GeoFinderCard.tsx (Mais perto vs Vale o desvio) com
// dado estático só pra ilustrar a decisão.

export function GeoFinderMockup() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-xl border border-border/40 p-3 text-left">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Mais perto</div>
        <div className="text-sm font-semibold leading-tight">Campeche</div>
        <div className="text-xs text-muted-foreground mt-0.5">1.2km de você</div>
        <div className="text-base font-bold mt-1.5 text-rating-fair">5.8 <span className="text-[10px] font-bold">REGULAR</span></div>
      </div>
      <div className="rounded-xl border-2 border-primary/50 bg-primary/5 p-3 text-left">
        <div className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1.5">Vale o desvio</div>
        <div className="text-sm font-semibold leading-tight">Joaquina</div>
        <div className="text-xs text-muted-foreground mt-0.5">4.6km de você</div>
        <div className="text-base font-bold mt-1.5 text-rating-epic">8.3 <span className="text-[10px] font-bold">ÉPICO</span></div>
      </div>
    </div>
  )
}

// ── Mockup: Melhor Janela do Dia ─────────────────────────────────────────────
// Reproduz o gráfico de barras real de BestWindowWidget.tsx com valores estáticos.

const WINDOW_BARS = [20, 30, 35, 45, 55, 70, 85, 95, 90, 65, 40, 25]

export function GoldenWindowMockup() {
  return (
    <div className="rounded-2xl p-4"
      style={{ background: 'oklch(1 0 0 / 0.03)', border: '1px solid oklch(1 0 0 / 0.08)' }}>
      <div className="text-xs font-bold text-rating-epic mb-3">Janela boa agora — vai até 15h</div>
      <div className="flex items-end gap-1" style={{ height: '48px' }}>
        {WINDOW_BARS.map((h, i) => (
          <div key={i} className="flex-1 rounded-sm"
            style={{
              height: `${h}%`,
              background: h >= 85 ? 'oklch(0.75 0.18 145)' : h >= 55 ? 'oklch(0.8 0.16 95)' : 'oklch(0.6 0.02 240 / 0.3)',
            }} />
        ))}
      </div>
    </div>
  )
}

// ── CTA Flutuante ─────────────────────────────────────────────────────────────

export function FloatingCTA({ onFree, onPremium }: { onFree: () => void; onPremium: () => void }) {
  const [visible, setVisible] = useState(false)
  const [isPremiumMode, setIsPremiumMode] = useState(false)

  // Troca pra "Assinar Premium" quando a seção de preço real (#pricing) cruza a metade
  // da tela. Antes usava IntersectionObserver com threshold:0, que só dispara UMA vez ao
  // entrar — nesse instante o topo do elemento ainda está perto do fundo da tela, então
  // a condição quase nunca era verdadeira ali, e o observer não reavalia de novo enquanto
  // a seção continua visível. Resultado: numa rolagem normal pra baixo, o modo Premium
  // praticamente nunca ativava enquanto a seção de preço estava de fato na tela — só
  // "acertava" depois de rolar past ela, quando já não fazia mais sentido nenhum. Um
  // listener de scroll comum reavalia a cada evento de rolagem, não só na entrada.
  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 500)
      const section = document.getElementById('pricing')
      if (section) setIsPremiumMode(section.getBoundingClientRect().top < window.innerHeight / 2)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
      {isPremiumMode ? (
        <Button size="lg" onClick={onPremium}
          className="font-bold px-8 h-12 text-sm shadow-2xl rounded-full"
          style={{
            background: 'linear-gradient(135deg, oklch(0.7 0.18 60), oklch(0.6 0.22 50))',
            color: 'oklch(0.1 0.02 240)',
            boxShadow: '0 0 32px oklch(0.6 0.18 60 / 0.5), 0 8px 24px rgba(0,0,0,0.4)',
          }}>
          <Crown className="h-4 w-4 mr-2" />
          Assinar Premium · a partir de R$ 12,49/mês
        </Button>
      ) : (
        <Button size="lg" onClick={onFree}
          className="font-bold px-8 h-12 text-sm shadow-2xl bg-primary hover:bg-primary/90 rounded-full"
          style={{ boxShadow: '0 0 32px oklch(0.6 0.16 200 / 0.5), 0 8px 24px rgba(0,0,0,0.4)' }}>
          Criar conta grátis
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      )}
    </div>
  )
}
