import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Check, X, Crown, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppLogo } from '@/components/AppLogo'
import { Waves, Wind, BarChart3, Bell, MapPin } from 'lucide-react'
import { MOCK_SPOTS, PREMIUM_SCROLL_THRESHOLD } from './landingData'

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

// ── Ondas SVG animadas ───────────────────────────────────────────────────────

export function OceanWaves() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" style={{ zIndex: 0 }}>
      <svg
        className="absolute bottom-0 left-0 w-full"
        style={{ height: '340px', opacity: 0.13 }}
        viewBox="0 0 1440 340"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="waveGrad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="waveGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path fill="url(#waveGrad1)">
          <animate attributeName="d" dur="8s" repeatCount="indefinite"
            values="
              M0,180 C240,120 480,240 720,180 C960,120 1200,240 1440,180 L1440,340 L0,340 Z;
              M0,200 C240,140 480,220 720,160 C960,100 1200,220 1440,200 L1440,340 L0,340 Z;
              M0,180 C240,120 480,240 720,180 C960,120 1200,240 1440,180 L1440,340 L0,340 Z
            "
          />
        </path>
        <path fill="url(#waveGrad2)" style={{ opacity: 0.5 }}>
          <animate attributeName="d" dur="6s" repeatCount="indefinite"
            values="
              M0,220 C360,160 720,280 1080,200 C1260,160 1380,240 1440,220 L1440,340 L0,340 Z;
              M0,240 C360,180 720,260 1080,220 C1260,180 1380,260 1440,240 L1440,340 L0,340 Z;
              M0,220 C360,160 720,280 1080,200 C1260,160 1380,240 1440,220 L1440,340 L0,340 Z
            "
          />
        </path>
        <path fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.3">
          <animate attributeName="d" dur="5s" repeatCount="indefinite"
            values="
              M0,160 C180,140 360,180 540,160 C720,140 900,180 1080,160 C1260,140 1380,170 1440,160;
              M0,170 C180,150 360,170 540,150 C720,130 900,170 1080,150 C1260,130 1380,160 1440,150;
              M0,160 C180,140 360,180 540,160 C720,140 900,180 1080,160 C1260,140 1380,170 1440,160
            "
          />
        </path>
      </svg>
      {[
        { top: '15%', left: '8%', size: 3, dur: '4s', delay: '0s' },
        { top: '30%', left: '18%', size: 2, dur: '5s', delay: '1s' },
        { top: '10%', left: '55%', size: 4, dur: '6s', delay: '0.5s' },
        { top: '25%', left: '72%', size: 2, dur: '4.5s', delay: '2s' },
        { top: '40%', left: '88%', size: 3, dur: '5.5s', delay: '1.5s' },
        { top: '60%', left: '35%', size: 2, dur: '4s', delay: '0.8s' },
        { top: '70%', left: '65%', size: 3, dur: '6s', delay: '3s' },
      ].map((p, i) => (
        <div key={i} className="absolute rounded-full"
          style={{
            top: p.top, left: p.left,
            width: p.size, height: p.size,
            background: i % 2 === 0 ? '#06b6d4' : '#8b5cf6',
            opacity: 0.4,
            animation: `particleFloat ${p.dur} ease-in-out ${p.delay} infinite`,
          }} />
      ))}
    </div>
  )
}

// ── Mockup 3D flutuante ──────────────────────────────────────────────────────

export function AppMockup3D() {
  const [active, setActive] = useState(0)
  const [mouseX, setMouseX] = useState(0)
  const [mouseY, setMouseY] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setInterval(() => setActive(p => (p + 1) % MOCK_SPOTS.length), 2200)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      setMouseX((e.clientX - cx) / rect.width)
      setMouseY((e.clientY - cy) / rect.height)
    }
    window.addEventListener('mousemove', handleMouse)
    return () => window.removeEventListener('mousemove', handleMouse)
  }, [])

  const rotateY = mouseX * 12
  const rotateX = -mouseY * 8

  return (
    <div ref={containerRef} className="relative flex justify-center lg:justify-end pt-8 pb-10" style={{ perspective: '900px' }}>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 lg:left-auto lg:right-8 lg:translate-x-0"
        style={{
          width: 180, height: 30,
          background: `radial-gradient(ellipse, ${MOCK_SPOTS[active].colorAlpha(33)}, transparent 70%)`,
          filter: 'blur(16px)',
          transition: 'background 0.8s ease',
        }} />
      <div style={{
        transform: `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`,
        transition: 'transform 0.1s ease-out',
        transformStyle: 'preserve-3d',
        animation: 'phoneFloat 4s ease-in-out infinite',
      }}>
        <div className="relative select-none" style={{ width: 260, height: 540 }}>
          <div className="absolute inset-[-24px] rounded-[60px] blur-3xl opacity-30 pointer-events-none"
            style={{ background: `radial-gradient(ellipse, ${MOCK_SPOTS[active].color}, transparent 70%)`, transition: 'background 0.8s ease' }} />
          <div className="absolute inset-0 rounded-[38px] pointer-events-none"
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%, rgba(0,0,0,0.15) 100%)', zIndex: 10 }} />
          <div className="relative w-full h-full rounded-[38px] overflow-hidden shadow-2xl"
            style={{ border: '2px solid oklch(0.35 0.06 240)', background: 'oklch(0.12 0.02 240)' }}>
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-6 rounded-full z-20 flex items-center justify-center gap-1.5"
              style={{ background: 'oklch(0.08 0.01 240)' }}>
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'oklch(0.4 0.08 200)' }} />
              <div className="h-2 w-2 rounded-full" style={{ background: 'oklch(0.3 0.06 240)' }} />
            </div>
            <div className="flex items-center justify-between px-4 pt-2 pb-0 mt-8">
              <span className="text-[9px] font-semibold text-white/50">9:41</span>
              <div className="flex items-center gap-1">
                <div className="flex gap-0.5 items-end h-3">
                  {[2, 3, 4, 4].map((h, i) => (
                    <div key={i} className="w-0.5 rounded-full bg-white/50" style={{ height: `${h * 3}px` }} />
                  ))}
                </div>
                <div className="text-[8px] text-white/50 ml-0.5">100%</div>
              </div>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AppLogo size={22} variant="icon" />
                <div>
                  <div className="text-[12px] font-black text-white leading-none">Surf AI</div>
                  <div className="text-[8px] font-medium" style={{ color: 'oklch(0.5 0.02 220)' }}>Florianópolis, SC</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 rounded-full px-2 py-1"
                style={{ background: 'oklch(0.5 0.16 150 / 0.15)', border: '1px solid oklch(0.5 0.16 150 / 0.3)' }}>
                <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-rating-good)' }} />
                <span className="text-[8px] font-semibold" style={{ color: 'var(--color-rating-good)' }}>ao vivo</span>
              </div>
            </div>
            <div className="mx-3 mb-3 rounded-2xl p-3.5 relative overflow-hidden"
              style={{
                background: MOCK_SPOTS[active].colorAlpha(9),
                border: `1px solid ${MOCK_SPOTS[active].colorAlpha(21)}`,
                transition: 'background 0.6s ease, border-color 0.6s ease',
              }}>
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 80% 50%, ${MOCK_SPOTS[active].colorAlpha(8)}, transparent)` }} />
              <div className="text-[8px] font-bold uppercase tracking-wider mb-1.5"
                style={{ color: MOCK_SPOTS[active].color, transition: 'color 0.6s ease' }}>
                Melhor pico agora
              </div>
              <div className="flex items-end justify-between relative">
                <div>
                  <div className="text-[15px] font-black text-white leading-tight">{MOCK_SPOTS[active].beach}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-0.5 text-[8px] text-white/50">
                      <Waves className="h-2.5 w-2.5" /> {MOCK_SPOTS[active].wave}
                    </span>
                    <span className="flex items-center gap-0.5 text-[8px] text-white/50">
                      <Wind className="h-2.5 w-2.5" /> {MOCK_SPOTS[active].wind}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[30px] font-black leading-none" style={{ color: MOCK_SPOTS[active].color, transition: 'color 0.6s ease' }}>
                    {MOCK_SPOTS[active].score}
                  </div>
                  <div className="text-[8px] font-bold" style={{ color: MOCK_SPOTS[active].color }}>{MOCK_SPOTS[active].label}</div>
                </div>
              </div>
            </div>
            <div className="px-3">
              <div className="text-[8px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'oklch(0.45 0.02 220)' }}>Todas as praias</div>
              <div className="space-y-1.5">
                {MOCK_SPOTS.map((spot, i) => (
                  <div key={spot.beach} className="flex items-center justify-between rounded-xl px-3 py-2 transition-all duration-300"
                    style={{
                      background: i === active ? spot.colorAlpha(9) : 'oklch(0.18 0.02 240)',
                      border: `1px solid ${i === active ? spot.colorAlpha(25) : 'oklch(0.28 0.03 240)'}`,
                    }}>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: spot.color }} />
                      <div>
                        <div className="text-[10px] font-semibold text-white">{spot.beach}</div>
                        <div className="text-[8px] text-white/40">{spot.wave} · {spot.period}</div>
                      </div>
                    </div>
                    <div className="text-[13px] font-black leading-none" style={{ color: spot.color }}>{spot.score}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 flex justify-around items-center py-3 px-4"
              style={{ background: 'oklch(0.14 0.02 240)', borderTop: '1px solid oklch(0.25 0.03 240)' }}>
              {[Waves, BarChart3, Bell, MapPin].map((Icon, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <Icon className="h-4 w-4" style={{ color: i === 0 ? 'oklch(0.6 0.16 200)' : 'oklch(0.4 0.02 220)' }} />
                  {i === 0 && <div className="h-1 w-1 rounded-full" style={{ background: 'oklch(0.6 0.16 200)' }} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
        {MOCK_SPOTS.map((_, i) => (
          <div key={i} className="h-1 rounded-full transition-all duration-300"
            style={{ width: i === active ? 16 : 4, background: i === active ? MOCK_SPOTS[active].color : 'oklch(0.35 0.03 240)' }} />
        ))}
      </div>
    </div>
  )
}

// ── Número animado ────────────────────────────────────────────────────────────

export function AnimatedNumber({ value, suffix }: { value: number; suffix: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const steps = 40
        const increment = value / steps
        let current = 0
        const timer = setInterval(() => {
          current += increment
          if (current >= value) { setCount(value); clearInterval(timer) }
          else setCount(Math.floor(current))
        }, 1200 / steps)
      }
    }, { threshold: 0.5 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
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
    const onScroll = () => {
      setVisible(window.scrollY > 500)
      setIsPremiumMode(window.scrollY > PREMIUM_SCROLL_THRESHOLD)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
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
          Assinar Premium — R$ 16,90/mês
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
