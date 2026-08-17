import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Check, X, Crown, ArrowRight } from 'lucide-react'
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

// ── Célula do plano ───────────────────────────────────────────────────────────

export function PlanCell({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="h-4 w-4 text-rating-good mx-auto" />
  if (value === false) return <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />
  return <span className="text-xs font-semibold text-primary">{value}</span>
}

// ── CTA Flutuante ─────────────────────────────────────────────────────────────

export function FloatingCTA({ onFree, onPremium }: { onFree: () => void; onPremium: () => void }) {
  const [visible, setVisible] = useState(false)
  const [isPremiumMode, setIsPremiumMode] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Troca pra "Assinar Premium" a partir do momento que a seção de preço real (#pricing)
  // entra na tela — antes dependia de um pixel fixo (PREMIUM_SCROLL_THRESHOLD) sem
  // nenhum vínculo com o layout real, quebrava a cada reordenação de seção.
  useEffect(() => {
    const section = document.getElementById('pricing')
    if (!section) return
    const observer = new IntersectionObserver(
      ([entry]) => setIsPremiumMode(entry.boundingClientRect.top < window.innerHeight / 2),
      { threshold: 0 }
    )
    observer.observe(section)
    return () => observer.disconnect()
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
          Assinar Premium · R$ 16,90/mês
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
