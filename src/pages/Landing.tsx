import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Waves, Zap, Bell, BarChart3, Clock, Shield,
  ArrowRight, CheckCircle2, Wind, TrendingUp,
  MapPin, Crown, ChevronRight, ChevronDown, X, Check,
  Star, Quote, Droplets, Lock,
  Smartphone
} from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'

// ─── Dados ───────────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  { name: 'Lucas T.', role: 'Intermediário · Coqueiros', avatar: 'LT', handle: '@lucast.surf', stars: 5, text: 'Fui na Mole ontem cedo, o score tava 8.4. Mar perfeito, quase vazio. Antes eu ia no achismo e voltava bastante frustrado. Agora pelo menos sei antes de sair de casa.' },
  { name: 'Ana F.', role: 'Iniciante · Norte da ilha', avatar: 'AF', handle: '@anaf.floripa', stars: 4, text: 'Pra mim que sou iniciante foi ótimo porque sempre fui na praia errada. Agora olho quais tão mais calmas e vou pra lá. Simples assim. Não perco mais tempo.' },
  { name: 'Bruno M.', role: 'Surfista · Campeche', avatar: 'BM', handle: '@brunomsurf', stars: 5, text: 'Usei pra planejar a semana de folga. Dos 6 dias que fui, 5 o mar tava bom mesmo. Não é 100% mas bem melhor do que depender de grupo de WhatsApp.' },
  { name: 'Rafael S.', role: 'Avançado · Joaquina', avatar: 'RS', handle: '@rafaelsurf_fpolis', stars: 5, text: 'O alerta de ondas mudou meu jogo. Acordo com a notificação, chego no pico quando ainda tá vazio. Melhor investimento do mês.' },
]

const PLAN_FEATURES = [
  { label: 'Score de IA em tempo real', free: true, premium: true },
  { label: '17 praias monitoradas', free: true, premium: true },
  { label: 'Favoritos e comparação', free: true, premium: true },
  { label: 'Log de sessões', free: true, premium: true },
  { label: 'Previsão de ondas', free: '3 dias', premium: '14 dias' },
  { label: 'Histórico de condições', free: false, premium: true },
  { label: 'Alertas de ondas push', free: false, premium: true },
  { label: 'Navegação até a praia', free: false, premium: true },
  { label: 'Experiência sem anúncios', free: false, premium: true },
  { label: 'Acesso antecipado a recursos', free: false, premium: true },
]

const FAQS = [
  { q: 'O app funciona para todas as praias de Florianópolis?', a: 'Sim! Monitoramos 17 praias distribuídas pelas 4 regiões da ilha: Norte, Leste, Centro e Sul. Cobrimos desde o Santinho até o Naufragados, passando por Praia Mole, Joaquina, Campeche e muito mais.' },
  { q: 'Os dados são atualizados com que frequência?', a: 'Os dados de ondas, vento e maré são atualizados a cada hora, 24 horas por dia, 7 dias por semana. O score de IA é recalculado automaticamente a cada nova atualização.' },
  { q: 'O plano gratuito tem alguma limitação?', a: 'No plano gratuito você tem acesso ao score de IA em tempo real, previsão para os próximos 3 dias, favoritos, log de sessões e comparação de praias. Para previsão de 14 dias, alertas push, histórico completo e navegação, é necessário o Premium.' },
  { q: 'Como funciona o score de IA?', a: 'Nossa IA analisa múltiplas variáveis em conjunto: altura e período das ondas, direção e intensidade do vento, fase da maré e swell predominante. O resultado é uma nota de 0 a 10 que representa a qualidade real das condições.' },
  { q: 'Posso cancelar o Premium quando quiser?', a: 'Sim, sem multa e sem burocracia. Você pode cancelar a qualquer momento pelo próprio app. O acesso Premium continua até o fim do período pago.' },
  { q: 'O app funciona no iPhone e no Android?', a: 'Sim! O Surf AI é um Progressive Web App (PWA) — funciona diretamente no navegador do seu celular, sem precisar baixar nada na loja. Adicione à tela inicial e use como um app nativo.' },
]

const STATS = [
  { value: 17, suffix: '', label: 'Praias monitoradas' },
  { value: 24, suffix: '/7', label: 'Atualização contínua' },
  { value: 14, suffix: ' dias', label: 'Previsão Premium' },
  { value: 4, suffix: '', label: 'Regiões da ilha' },
]

const MOCK_SPOTS = [
  { beach: 'Praia Mole', score: 9.1, wave: '1.2m', wind: '12km/h', period: '13s', color: '#8b5cf6', label: 'ÉPICO' },
  { beach: 'Joaquina', score: 7.8, wave: '1.0m', wind: '15km/h', period: '11s', color: '#06b6d4', label: 'EXCELENTE' },
  { beach: 'Campeche', score: 6.5, wave: '0.8m', wind: '18km/h', period: '10s', color: '#22c55e', label: 'BOM' },
  { beach: 'Santinho', score: 4.2, wave: '0.6m', wind: '25km/h', period: '7s', color: '#f59e0b', label: 'REGULAR' },
]

const PAIN_POINTS = [
  { emoji: '😤', problem: 'Chegou na praia e o mar estava péssimo', solution: 'Score em tempo real antes de sair de casa' },
  { emoji: '⏰', problem: 'Perdeu o horário de pico porque não sabia', solution: 'Alertas quando seu spot atingir o score ideal' },
  { emoji: '📍', problem: 'Sempre vai na mesma praia sem saber se tem melhor opção', solution: 'Compare 17 praias lado a lado em segundos' },
]

const PREMIUM_SCROLL_THRESHOLD = 2200

// ─── Hook: animação de entrada no scroll ──────────────────────────────────────

function useReveal(threshold = 0.15) {
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

// ─── Ondas SVG animadas ────────────────────────────────────────────────────────

function OceanWaves() {
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
        {/* onda 1 — mais lenta */}
        <path fill="url(#waveGrad1)" style={{ animation: 'waveMove1 8s ease-in-out infinite' }}>
          <animate attributeName="d" dur="8s" repeatCount="indefinite"
            values="
              M0,180 C240,120 480,240 720,180 C960,120 1200,240 1440,180 L1440,340 L0,340 Z;
              M0,200 C240,140 480,220 720,160 C960,100 1200,220 1440,200 L1440,340 L0,340 Z;
              M0,180 C240,120 480,240 720,180 C960,120 1200,240 1440,180 L1440,340 L0,340 Z
            "
          />
        </path>
        {/* onda 2 — mais rápida, deslocada */}
        <path fill="url(#waveGrad2)" style={{ opacity: 0.5 }}>
          <animate attributeName="d" dur="6s" repeatCount="indefinite"
            values="
              M0,220 C360,160 720,280 1080,200 C1260,160 1380,240 1440,220 L1440,340 L0,340 Z;
              M0,240 C360,180 720,260 1080,220 C1260,180 1380,260 1440,240 L1440,340 L0,340 Z;
              M0,220 C360,160 720,280 1080,200 C1260,160 1380,240 1440,220 L1440,340 L0,340 Z
            "
          />
        </path>
        {/* onda 3 — linha fina de espuma */}
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

      {/* partículas flutuantes */}
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

// ─── Mockup 3D flutuante ──────────────────────────────────────────────────────

function AppMockup3D() {
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
    <div ref={containerRef} className="relative flex justify-center lg:justify-end pt-8 pb-10"
      style={{ perspective: '900px' }}>

      {/* sombra no chão */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 lg:left-auto lg:right-8 lg:translate-x-0"
        style={{
          width: 180, height: 30,
          background: `radial-gradient(ellipse, ${MOCK_SPOTS[active].color}55, transparent 70%)`,
          filter: 'blur(16px)',
          transition: 'background 0.8s ease',
        }} />

      {/* wrapper 3D */}
      <div style={{
        transform: `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`,
        transition: 'transform 0.1s ease-out',
        transformStyle: 'preserve-3d',
        animation: 'phoneFloat 4s ease-in-out infinite',
      }}>
        <div className="relative select-none" style={{ width: 260, height: 540 }}>
          {/* glow */}
          <div className="absolute inset-[-24px] rounded-[60px] blur-3xl opacity-30 pointer-events-none"
            style={{ background: `radial-gradient(ellipse, ${MOCK_SPOTS[active].color}, transparent 70%)`, transition: 'background 0.8s ease' }} />

          {/* reflexo lateral 3D */}
          <div className="absolute inset-0 rounded-[38px] pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%, rgba(0,0,0,0.15) 100%)',
              zIndex: 10,
            }} />

          {/* frame */}
          <div className="relative w-full h-full rounded-[38px] overflow-hidden shadow-2xl"
            style={{ border: '2px solid oklch(0.35 0.06 240)', background: 'oklch(0.12 0.02 240)' }}>

            {/* dynamic island */}
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-6 rounded-full z-20 flex items-center justify-center gap-1.5"
              style={{ background: 'oklch(0.08 0.01 240)' }}>
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'oklch(0.4 0.08 200)' }} />
              <div className="h-2 w-2 rounded-full" style={{ background: 'oklch(0.3 0.06 240)' }} />
            </div>

            {/* status bar */}
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

            {/* app header */}
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
                <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
                <span className="text-[8px] font-semibold" style={{ color: '#22c55e' }}>ao vivo</span>
              </div>
            </div>

            {/* melhor pico card */}
            <div className="mx-3 mb-3 rounded-2xl p-3.5 relative overflow-hidden"
              style={{
                background: `${MOCK_SPOTS[active].color}18`,
                border: `1px solid ${MOCK_SPOTS[active].color}35`,
                transition: 'background 0.6s ease, border-color 0.6s ease',
              }}>
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 80% 50%, ${MOCK_SPOTS[active].color}15, transparent)` }} />
              <div className="text-[8px] font-bold uppercase tracking-wider mb-1.5"
                style={{ color: MOCK_SPOTS[active].color, transition: 'color 0.6s ease' }}>
                Melhor pico agora
              </div>
              <div className="flex items-end justify-between relative">
                <div>
                  <div className="text-[15px] font-black text-white leading-tight" style={{ transition: 'all 0.4s ease' }}>
                    {MOCK_SPOTS[active].beach}
                  </div>
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
                  <div className="text-[8px] font-bold" style={{ color: MOCK_SPOTS[active].color }}>
                    {MOCK_SPOTS[active].label}
                  </div>
                </div>
              </div>
            </div>

            {/* lista de praias */}
            <div className="px-3">
              <div className="text-[8px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'oklch(0.45 0.02 220)' }}>
                Todas as praias
              </div>
              <div className="space-y-1.5">
                {MOCK_SPOTS.map((spot, i) => (
                  <div key={spot.beach}
                    className="flex items-center justify-between rounded-xl px-3 py-2 transition-all duration-300"
                    style={{
                      background: i === active ? `${spot.color}18` : 'oklch(0.18 0.02 240)',
                      border: `1px solid ${i === active ? spot.color + '40' : 'oklch(0.28 0.03 240)'}`,
                    }}>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: spot.color }} />
                      <div>
                        <div className="text-[10px] font-semibold text-white">{spot.beach}</div>
                        <div className="text-[8px] text-white/40">{spot.wave} · {spot.period}</div>
                      </div>
                    </div>
                    <div className="text-[13px] font-black leading-none" style={{ color: spot.color }}>
                      {spot.score}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* bottom nav */}
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

      {/* dots */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
        {MOCK_SPOTS.map((_, i) => (
          <div key={i} className="h-1 rounded-full transition-all duration-300"
            style={{
              width: i === active ? 16 : 4,
              background: i === active ? MOCK_SPOTS[active].color : 'oklch(0.35 0.03 240)',
            }} />
        ))}
      </div>
    </div>
  )
}

// ─── Número animado ────────────────────────────────────────────────────────────

function AnimatedNumber({ value, suffix }: { value: number; suffix: string }) {
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

// ─── FAQ ──────────────────────────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
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

function PlanCell({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="h-4 w-4 text-green-400 mx-auto" />
  if (value === false) return <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />
  return <span className="text-xs font-semibold text-primary">{value}</span>
}

// ─── CTA Flutuante ────────────────────────────────────────────────────────────

function FloatingCTA({ onFree, onPremium }: { onFree: () => void; onPremium: () => void }) {
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
          Assinar Premium — R$ 29,90/mês
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

// ─── Reveal wrapper ────────────────────────────────────────────────────────────

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
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

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden relative">

      {/* CAMADAS DE FUNDO */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[700px] h-[700px] rounded-full blur-[140px] opacity-[0.06]"
          style={{ background: 'oklch(0.6 0.22 220)' }} />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-[0.04]"
          style={{ background: 'oklch(0.65 0.2 290)' }} />
        <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] rounded-full blur-[100px] opacity-[0.04]"
          style={{ background: 'oklch(0.6 0.18 160)' }} />
      </div>

      {/* NAV */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl border-b"
        style={{ background: 'oklch(var(--background) / 0.75)', borderColor: 'oklch(1 0 0 / 0.06)' }}>
        <div className="container mx-auto px-5 py-3 flex items-center justify-between max-w-6xl">
          <div className="flex items-center gap-2.5">
            <AppLogo size={34} variant="full" />
            <Badge variant="outline" className="hidden sm:flex border-primary/30 text-primary bg-primary/5 text-[10px] px-2 py-0.5">
              Florianópolis
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}
              className="text-sm text-muted-foreground hover:text-foreground">
              Entrar
            </Button>
            <Button size="sm" onClick={() => navigate('/login')}
              className="text-sm font-bold px-4 bg-primary hover:bg-primary/90"
              style={{ boxShadow: '0 0 16px oklch(0.6 0.16 200 / 0.25)' }}>
              Começar grátis
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-16 pb-4 overflow-hidden">
        <OceanWaves />

        {/* glow hero */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-[100px] opacity-20"
            style={{ background: 'radial-gradient(ellipse, oklch(0.6 0.2 210), transparent 70%)' }} />
        </div>

        <div className="container mx-auto px-5 max-w-6xl relative" style={{ zIndex: 2 }}>
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Texto */}
            <div className="space-y-7">
              <div className="flex flex-wrap gap-2" style={{ animation: 'fadeIn 0.6s ease both' }}>
                <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5 px-3 py-1 text-xs font-semibold">
                  <Zap className="h-3 w-3 mr-1.5 fill-current" />
                  Inteligência Artificial
                </Badge>
                <Badge variant="outline" className="border-green-500/40 text-green-400 bg-green-500/5 px-3 py-1 text-xs font-semibold">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-400 mr-1.5 animate-pulse" />
                  Dados em tempo real
                </Badge>
              </div>

              <div className="space-y-3">
                <h1 className="text-5xl md:text-6xl font-black leading-[1.05] tracking-tight overflow-hidden">
                  <span className="block" style={{ animation: 'textReveal 0.7s ease 0.1s both' }}>
                    O surf de{' '}
                    <span className="relative inline-block">
                      <span className="text-transparent bg-clip-text"
                        style={{
                          backgroundImage: 'linear-gradient(135deg, oklch(0.75 0.16 200), oklch(0.55 0.22 260), oklch(0.65 0.2 200))',
                          backgroundSize: '200% 200%',
                          animation: 'gradientShift 4s ease infinite',
                        }}>
                        Floripa
                      </span>
                      <svg className="absolute -bottom-1 left-0 w-full" height="4" viewBox="0 0 100 4" preserveAspectRatio="none">
                        <path d="M0,2 Q25,0 50,2 Q75,4 100,2" stroke="oklch(0.6 0.16 200)" strokeWidth="2" fill="none" strokeLinecap="round" />
                      </svg>
                    </span>
                  </span>
                  <span className="block" style={{ animation: 'textReveal 0.7s ease 0.25s both' }}>
                    na palma da mão.
                  </span>
                </h1>
                <p className="text-lg text-muted-foreground max-w-lg leading-relaxed"
                  style={{ animation: 'fadeIn 0.7s ease 0.4s both' }}>
                  Score de IA para 17 praias. Previsão de ondas, alertas e histórico —
                  tudo que você precisa para não perder a melhor sessão da semana.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3" style={{ animation: 'slideUp 0.6s ease 0.5s both' }}>
                <Button size="lg" onClick={() => navigate('/login')}
                  className="text-base font-bold px-8 h-12 flex-1 sm:flex-none relative overflow-hidden group"
                  style={{
                    background: 'oklch(0.6 0.2 210)',
                    boxShadow: '0 0 40px oklch(0.6 0.2 210 / 0.5), 0 0 80px oklch(0.6 0.2 210 / 0.2), inset 0 1px 0 oklch(1 0 0 / 0.15)',
                    animation: 'pulse-glow 3s ease-in-out infinite',
                  }}>
                  <span className="relative z-10 flex items-center gap-2">
                    Criar conta grátis
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                  {/* shimmer */}
                  <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%)' }} />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/login?plan=premium')}
                  className="text-base font-bold px-8 h-12 flex-1 sm:flex-none"
                  style={{
                    background: 'oklch(0.65 0.18 50 / 0.06)',
                    borderColor: 'oklch(0.65 0.18 50 / 0.35)',
                    backdropFilter: 'blur(12px)',
                  }}>
                  <Crown className="h-4 w-4 mr-2 text-yellow-400" />
                  Ver Premium
                </Button>
              </div>

              <div className="flex flex-wrap gap-4" style={{ animation: 'fadeIn 0.6s ease 0.65s both' }}>
                {['Grátis para começar', 'Sem cartão de crédito', 'Instala em 1 minuto'].map(t => (
                  <span key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />{t}
                  </span>
                ))}
              </div>

              {/* prova social */}
              <div className="flex items-center gap-3 pt-1" style={{ animation: 'fadeIn 0.6s ease 0.75s both' }}>
                <div className="flex -space-x-2">
                  {['LT', 'AF', 'BM', 'RS'].map((initials, i) => (
                    <div key={i} className="h-8 w-8 rounded-full border-2 border-background flex items-center justify-center text-[9px] font-black"
                      style={{ background: `oklch(${0.5 + i * 0.05} 0.12 ${200 + i * 30})`, color: 'white' }}>
                      {initials}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1 mb-0.5">
                    {[1, 2, 3, 4, 5].map(i => <Star key={i} className="h-3 w-3 text-yellow-400 fill-yellow-400" />)}
                  </div>
                  <p className="text-xs text-muted-foreground">Avaliado 5 estrelas pelos primeiros usuários</p>
                </div>
              </div>
            </div>

            {/* Mockup 3D */}
            <AppMockup3D />
          </div>
        </div>
      </section>

      {/* PREÇO ANTECIPADO */}
      <section className="py-6 relative z-10"
        style={{ borderTop: '1px solid oklch(1 0 0 / 0.06)', background: 'oklch(0.6 0.2 210 / 0.04)', backdropFilter: 'blur(20px)' }}>
        <div className="container mx-auto px-5 max-w-5xl">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-semibold">Plano gratuito disponível</span>
            </div>
            <span className="hidden sm:block text-muted-foreground/40">·</span>
            <span className="text-sm text-muted-foreground">Premium com previsão 14 dias + alertas por</span>
            <span className="text-sm font-black text-primary">R$ 29,90/mês</span>
            <button onClick={() => navigate('/login?plan=premium')}
              className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">
              Ver plano →
            </button>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-10 relative z-10"
        style={{ borderTop: '1px solid oklch(1 0 0 / 0.06)', borderBottom: '1px solid oklch(1 0 0 / 0.06)', background: 'oklch(1 0 0 / 0.015)', backdropFilter: 'blur(20px)' }}>
        <div className="container mx-auto px-5 max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map(({ value, suffix, label }) => (
              <div key={label} className="text-center">
                <AnimatedNumber value={value} suffix={suffix} />
                <div className="text-sm text-muted-foreground mt-1 font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DOR → SOLUÇÃO */}
      <section className="py-20">
        <div className="container mx-auto px-5 max-w-4xl">
          <Reveal className="text-center mb-12">
            <Badge variant="outline" className="border-red-500/30 text-red-400 bg-red-500/5 mb-4 px-4 py-1">
              Reconhece alguma situação?
            </Badge>
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              Chegar na praia e o mar estar péssimo<br />
              <span className="text-muted-foreground font-medium text-2xl">é frustrante — e evitável.</span>
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-5">
            {PAIN_POINTS.map(({ emoji, problem, solution }, i) => (
              <Reveal key={problem} delay={i * 0.12}>
                <div className="rounded-2xl p-6 space-y-4 h-full transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
                  style={{
                    background: 'oklch(1 0 0 / 0.025)',
                    border: '1px solid oklch(1 0 0 / 0.08)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 4px 24px oklch(0 0 0 / 0.15), inset 0 1px 0 oklch(1 0 0 / 0.06)',
                  }}>
                  <div className="text-3xl">{emoji}</div>
                  <div>
                    <p className="text-sm font-semibold text-foreground/80 mb-3 line-through decoration-red-400/60">{problem}</p>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-green-400 font-semibold">{solution}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="py-20 border-t border-border/30 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none select-none opacity-[0.025]"
          style={{
            backgroundImage: 'linear-gradient(oklch(0.6 0.2 210) 1px, transparent 1px), linear-gradient(90deg, oklch(0.6 0.2 210) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
        <div className="container mx-auto px-5 max-w-5xl relative">
          <Reveal className="text-center mb-14">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-4 px-4 py-1">
              Como funciona
            </Badge>
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              Enquanto você lê isso, tem gente<br />surfando na praia certa.
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">Em menos de 1 minuto você sabe se vale sair de casa — sem chute, sem grupo de WhatsApp, sem frustração.</p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-12 left-[calc(16.67%+16px)] right-[calc(16.67%+16px)] h-px"
              style={{ background: 'linear-gradient(90deg, oklch(0.6 0.16 200 / 0.5), oklch(0.6 0.16 200 / 0.2))' }} />
            {[
              { step: '01', icon: Droplets, title: 'Dados em tempo real', desc: 'Coletamos dados de ondas, vento e maré de múltiplas fontes meteorológicas a cada hora, 24/7.' },
              { step: '02', icon: Zap, title: 'IA calcula o score', desc: 'Nossa IA analisa todos os parâmetros e gera uma nota de 0 a 10 considerando o seu nível de surf.' },
              { step: '03', icon: TrendingUp, title: 'Você decide em segundos', desc: 'Veja o score, compare praias e tome a melhor decisão — sem desperdício de tempo ou gasolina.' },
            ].map(({ step, icon: Icon, title, desc }, i) => (
              <Reveal key={step} delay={i * 0.15}>
                <div className="relative flex flex-col items-center text-center">
                  <div className="relative mb-5">
                    <div className="h-16 w-16 rounded-2xl flex items-center justify-center relative z-10"
                      style={{
                        background: 'oklch(0.6 0.2 210 / 0.08)',
                        border: '1px solid oklch(0.6 0.2 210 / 0.3)',
                        backdropFilter: 'blur(12px)',
                        boxShadow: '0 0 32px oklch(0.6 0.2 210 / 0.2), inset 0 1px 0 oklch(1 0 0 / 0.1)',
                      }}>
                      <Icon className="h-7 w-7 text-primary" />
                    </div>
                    <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black"
                      style={{ background: 'oklch(0.6 0.2 210)', color: 'white', boxShadow: '0 0 12px oklch(0.6 0.2 210 / 0.5)' }}>
                      {i + 1}
                    </div>
                  </div>
                  {i < 2 && <ChevronRight className="md:hidden absolute right-0 top-6 h-5 w-5 text-primary/30" />}
                  <h3 className="font-bold text-base mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES — BENTO GRID */}
      <section className="py-20 border-t border-border/30">
        <div className="container mx-auto px-5 max-w-5xl">
          <Reveal className="text-center mb-14">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-4 px-4 py-1">Funcionalidades</Badge>
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              Pare de adivinhar.<br />Comece a surfar na hora certa.
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Feito por surfistas, para surfistas. Dados reais, análise inteligente, decisão rápida.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 auto-rows-auto">

            <Reveal className="md:col-span-4">
              <div className="group rounded-2xl p-7 transition-all duration-300 cursor-default relative overflow-hidden hover:-translate-y-1"
                style={{
                  background: 'oklch(0.6 0.2 210 / 0.07)',
                  border: '1px solid oklch(0.6 0.2 210 / 0.25)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 4px 32px oklch(0 0 0 / 0.2), 0 0 60px oklch(0.6 0.2 210 / 0.08), inset 0 1px 0 oklch(1 0 0 / 0.08)',
                }}>
                <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, oklch(0.6 0.2 210 / 0.12), transparent 70%)' }} />
                <div className="flex items-start justify-between mb-5">
                  <div className="h-11 w-11 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                    style={{ background: 'oklch(0.75 0.18 55 / 0.15)', border: '1px solid oklch(0.75 0.18 55 / 0.35)' }}>
                    <Zap className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="flex items-stretch gap-2">
                    {[
                      { score: 9.1, color: '#8b5cf6', label: 'Mole', bg: 'oklch(0.55 0.18 290 / 0.15)', border: 'oklch(0.55 0.18 290 / 0.3)' },
                      { score: 7.8, color: '#06b6d4', label: 'Joa.', bg: 'oklch(0.6 0.18 200 / 0.15)', border: 'oklch(0.6 0.18 200 / 0.3)' },
                      { score: 6.5, color: '#22c55e', label: 'Cam.', bg: 'oklch(0.55 0.18 145 / 0.15)', border: 'oklch(0.55 0.18 145 / 0.3)' },
                    ].map(({ score, color, label, bg, border }) => (
                      <div key={label} className="flex flex-col items-center justify-between rounded-xl px-3 py-2.5 min-w-[52px]"
                        style={{ background: bg, border: `1px solid ${border}` }}>
                        <span className="text-[18px] font-black leading-none" style={{ color }}>{score}</span>
                        <div className="h-px w-full my-1.5" style={{ background: color + '40' }} />
                        <span className="text-[9px] font-semibold text-muted-foreground">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <h3 className="font-bold text-xl mb-2">Score de IA em tempo real</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                  IA analisa altura, período, vento e maré para gerar uma nota de 0 a 10 para cada praia — atualizada a cada hora.
                </p>
                <div className="mt-5 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full animate-pulse bg-green-400" />
                  <span className="text-xs text-muted-foreground">Atualizado agora</span>
                </div>
              </div>
            </Reveal>

            <Reveal className="md:col-span-2" delay={0.1}>
              <div className="group rounded-2xl p-7 h-full transition-all duration-300 cursor-default relative overflow-hidden hover:-translate-y-1"
                style={{
                  background: 'oklch(0.6 0.16 200 / 0.06)',
                  border: '1px solid oklch(0.6 0.16 200 / 0.22)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 4px 32px oklch(0 0 0 / 0.2), inset 0 1px 0 oklch(1 0 0 / 0.06)',
                }}>
                <div className="h-11 w-11 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300"
                  style={{ background: 'oklch(0.6 0.16 200 / 0.15)', border: '1px solid oklch(0.6 0.16 200 / 0.35)' }}>
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="mb-5 grid grid-cols-6 gap-1.5">
                  {Array.from({ length: 17 }).map((_, i) => (
                    <div key={i} className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background: i < 6 ? 'oklch(0.6 0.16 200)' : i < 12 ? 'oklch(0.6 0.16 200 / 0.45)' : 'oklch(0.6 0.16 200 / 0.2)',
                        boxShadow: i < 6 ? '0 0 6px oklch(0.6 0.16 200 / 0.6)' : 'none',
                      }} />
                  ))}
                </div>
                <h3 className="font-bold text-base mb-1.5">17 praias monitoradas</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Cobertura completa de Florianópolis — Norte ao Sul da ilha.
                </p>
              </div>
            </Reveal>

            <Reveal className="md:col-span-2" delay={0.05}>
              <div className="group rounded-2xl p-7 h-full transition-all duration-300 cursor-default relative overflow-hidden hover:-translate-y-1"
                style={{
                  background: 'oklch(0.55 0.18 290 / 0.07)',
                  border: '1px solid oklch(0.55 0.18 290 / 0.25)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 4px 32px oklch(0 0 0 / 0.2), inset 0 1px 0 oklch(1 0 0 / 0.06)',
                }}>
                <div className="h-11 w-11 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300"
                  style={{ background: 'oklch(0.55 0.18 290 / 0.15)', border: '1px solid oklch(0.55 0.18 290 / 0.35)' }}>
                  <BarChart3 className="h-5 w-5 text-violet-400" />
                </div>
                <div className="mb-5 flex items-end gap-1 h-12 rounded-xl p-2"
                  style={{ background: 'oklch(0.55 0.18 290 / 0.06)', border: '1px solid oklch(0.55 0.18 290 / 0.12)' }}>
                  {[3, 5, 4, 7, 9, 6, 5, 8, 9, 6, 4, 5, 7, 6].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t transition-all duration-300"
                      style={{
                        height: `${h * 4}px`,
                        background: h >= 8 ? 'oklch(0.55 0.18 290)' : h >= 6 ? 'oklch(0.55 0.18 290 / 0.6)' : 'oklch(0.55 0.18 290 / 0.25)',
                      }} />
                  ))}
                </div>
                <h3 className="font-bold text-base mb-1.5">Previsão de 14 dias</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Planeje com antecedência. Ondas, vento e maré para 2 semanas.
                </p>
              </div>
            </Reveal>

            <Reveal className="md:col-span-2" delay={0.1}>
              <div className="group rounded-2xl p-7 h-full transition-all duration-300 cursor-default relative overflow-hidden hover:-translate-y-1"
                style={{
                  background: 'oklch(0.55 0.18 145 / 0.07)',
                  border: '1px solid oklch(0.55 0.18 145 / 0.25)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 4px 32px oklch(0 0 0 / 0.2), inset 0 1px 0 oklch(1 0 0 / 0.06)',
                }}>
                <div className="h-11 w-11 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300"
                  style={{ background: 'oklch(0.55 0.18 145 / 0.15)', border: '1px solid oklch(0.55 0.18 145 / 0.35)' }}>
                  <Bell className="h-5 w-5 text-green-400" />
                </div>
                <div className="mb-5 rounded-xl p-3 flex items-start gap-2.5"
                  style={{ background: 'oklch(0.55 0.18 145 / 0.08)', border: '1px solid oklch(0.55 0.18 145 / 0.2)' }}>
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'oklch(0.55 0.18 145 / 0.2)' }}>
                    <Waves className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-green-400 leading-tight">Praia Mole — Score 9.1</div>
                    <div className="text-[10px] text-muted-foreground mt-1">Seu alerta foi ativado · agora</div>
                  </div>
                  <div className="ml-auto h-2 w-2 rounded-full bg-green-400 animate-pulse flex-shrink-0 mt-1" />
                </div>
                <h3 className="font-bold text-base mb-1.5">Alertas personalizados</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Notificação quando seu spot atingir o score que você definiu.
                </p>
              </div>
            </Reveal>

            <Reveal className="md:col-span-2" delay={0.15}>
              <div className="group rounded-2xl p-7 h-full transition-all duration-300 cursor-default relative overflow-hidden hover:-translate-y-1"
                style={{
                  background: 'oklch(0.65 0.18 50 / 0.06)',
                  border: '1px solid oklch(0.65 0.18 50 / 0.22)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 4px 32px oklch(0 0 0 / 0.2), inset 0 1px 0 oklch(1 0 0 / 0.06)',
                }}>
                <div className="h-11 w-11 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300"
                  style={{ background: 'oklch(0.65 0.18 50 / 0.15)', border: '1px solid oklch(0.65 0.18 50 / 0.35)' }}>
                  <Clock className="h-5 w-5 text-orange-400" />
                </div>
                <div className="mb-5 rounded-xl overflow-hidden p-3"
                  style={{ background: 'oklch(0.65 0.18 50 / 0.06)', border: '1px solid oklch(0.65 0.18 50 / 0.15)' }}>
                  <svg viewBox="0 0 120 36" className="w-full h-8" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.65 0.18 50)" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="oklch(0.65 0.18 50)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,28 L15,22 L30,26 L45,12 L60,18 L75,8 L90,14 L105,6 L120,10" fill="none" stroke="oklch(0.65 0.18 50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M0,28 L15,22 L30,26 L45,12 L60,18 L75,8 L90,14 L105,6 L120,10 L120,36 L0,36 Z" fill="url(#sparkGrad)" />
                  </svg>
                </div>
                <h3 className="font-bold text-base mb-1.5">Histórico e tendências</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Condições dos últimos dias e os melhores padrões de swell.
                </p>
              </div>
            </Reveal>

            <Reveal className="md:col-span-2" delay={0.2}>
              <div className="group rounded-2xl p-7 h-full transition-all duration-300 cursor-default relative overflow-hidden hover:-translate-y-1"
                style={{
                  background: 'oklch(0.6 0.18 195 / 0.06)',
                  border: '1px solid oklch(0.6 0.18 195 / 0.22)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 4px 32px oklch(0 0 0 / 0.2), inset 0 1px 0 oklch(1 0 0 / 0.06)',
                }}>
                <div className="h-11 w-11 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300"
                  style={{ background: 'oklch(0.6 0.18 195 / 0.15)', border: '1px solid oklch(0.6 0.18 195 / 0.35)' }}>
                  <Waves className="h-5 w-5 text-cyan-400" />
                </div>
                <div className="mb-5 space-y-2">
                  {[
                    { date: 'Hoje', beach: 'Praia Mole', score: '9.1', color: '#8b5cf6', bg: 'oklch(0.55 0.18 290 / 0.1)', border: 'oklch(0.55 0.18 290 / 0.2)' },
                    { date: 'Ontem', beach: 'Joaquina', score: '7.8', color: '#06b6d4', bg: 'oklch(0.6 0.18 200 / 0.08)', border: 'oklch(0.6 0.18 200 / 0.18)' },
                  ].map(({ date, beach, score, color, bg, border }) => (
                    <div key={date} className="flex items-center justify-between rounded-lg px-3 py-2"
                      style={{ background: bg, border: `1px solid ${border}` }}>
                      <div>
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{date} · </span>
                        <span className="text-[11px] font-semibold">{beach}</span>
                      </div>
                      <span className="text-[14px] font-black" style={{ color }}>{score}</span>
                    </div>
                  ))}
                </div>
                <h3 className="font-bold text-base mb-1.5">Log de sessões</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Registre suas sessões, notas e memórias. Seu diário de surf.
                </p>
              </div>
            </Reveal>

          </div>

          {/* CTA dentro das features */}
          <Reveal className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate('/login')}
              className="font-bold px-8 h-12 text-sm bg-primary hover:bg-primary/90"
              style={{ boxShadow: '0 0 32px oklch(0.6 0.16 200 / 0.4)' }}>
              Criar conta grátis
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/login?plan=premium')}
              className="font-bold px-8 h-12 text-sm"
              style={{ borderColor: 'oklch(0.65 0.18 50 / 0.4)', color: 'oklch(0.7 0.15 50)' }}>
              <Crown className="h-4 w-4 mr-2" />
              Ver Premium — R$ 29,90/mês
            </Button>
          </Reveal>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section className="py-20 border-t border-border/30">
        <div className="container mx-auto px-5 max-w-5xl">
          <Reveal className="text-center mb-14">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-4 px-4 py-1">Depoimentos</Badge>
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              Todo dia alguém chega na praia<br />na hora certa por causa disso.
            </h2>
            <div className="flex items-center justify-center gap-1 mb-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
              ))}
              <span className="text-sm text-muted-foreground ml-2">5.0 · Avaliado pelos primeiros surfistas de Floripa</span>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {TESTIMONIALS.map(({ name, role, avatar, handle, stars, text }, i) => (
              <Reveal key={name} delay={i * 0.1}>
                <div className="rounded-2xl p-6 flex flex-col gap-4 h-full transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
                  style={{
                    background: 'oklch(1 0 0 / 0.025)',
                    border: '1px solid oklch(1 0 0 / 0.08)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 4px 24px oklch(0 0 0 / 0.15), inset 0 1px 0 oklch(1 0 0 / 0.06)',
                  }}>
                  <Quote className="h-6 w-6 text-primary/25" />
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">"{text}"</p>
                  <div>
                    <div className="flex gap-0.5 mb-3">
                      {Array.from({ length: stars }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                        {avatar}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{name}</div>
                        <div className="text-xs text-muted-foreground">{role}</div>
                        <div className="text-[10px] text-primary/50 mt-0.5">{handle}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARATIVO PLANOS */}
      <section className="py-20 border-t border-border/30">
        <div className="container mx-auto px-5 max-w-3xl">
          <Reveal className="text-center mb-14">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-4 px-4 py-1">Planos</Badge>
            <h2 className="text-3xl md:text-4xl font-black mb-4">Quanto custa perder<br />uma sessão épica?</h2>
            <p className="text-muted-foreground">Comece grátis. Upgrade quando quiser — sem complicação.</p>
          </Reveal>

          <Reveal>
            <div className="rounded-2xl overflow-hidden"
              style={{
                border: '1px solid oklch(1 0 0 / 0.08)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 8px 40px oklch(0 0 0 / 0.25), inset 0 1px 0 oklch(1 0 0 / 0.06)',
              }}>
              <div className="grid grid-cols-3 border-b"
                style={{ background: 'oklch(1 0 0 / 0.04)', borderColor: 'oklch(1 0 0 / 0.06)' }}>
                <div className="p-4 text-sm font-semibold text-muted-foreground">Recurso</div>
                <div className="p-4 text-center border-l" style={{ borderColor: 'oklch(1 0 0 / 0.06)' }}>
                  <div className="text-sm font-bold">Grátis</div>
                  <div className="text-xs text-muted-foreground">R$ 0</div>
                </div>
                <div className="p-4 text-center border-l relative"
                  style={{ borderColor: 'oklch(1 0 0 / 0.06)', background: 'oklch(0.6 0.2 210 / 0.06)' }}>
                  <div className="text-sm font-bold text-primary flex items-center justify-center gap-1.5">
                    <Crown className="h-3.5 w-3.5 text-yellow-400" />Premium
                  </div>
                  <div className="text-xs text-yellow-400 font-semibold">R$ 29,90/mês</div>
                </div>
              </div>
              {PLAN_FEATURES.map(({ label, free, premium }, i) => (
                <div key={label} className="grid grid-cols-3 border-b last:border-0"
                  style={{ borderColor: 'oklch(1 0 0 / 0.05)', background: i % 2 === 0 ? 'transparent' : 'oklch(1 0 0 / 0.015)' }}>
                  <div className="p-4 text-sm text-muted-foreground">{label}</div>
                  <div className="p-4 text-center border-l flex items-center justify-center" style={{ borderColor: 'oklch(1 0 0 / 0.05)' }}>
                    <PlanCell value={free} />
                  </div>
                  <div className="p-4 text-center border-l flex items-center justify-center"
                    style={{ borderColor: 'oklch(1 0 0 / 0.05)', background: 'oklch(0.6 0.2 210 / 0.03)' }}>
                    <PlanCell value={premium} />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-3 border-t" style={{ background: 'oklch(1 0 0 / 0.02)', borderColor: 'oklch(1 0 0 / 0.06)' }}>
                <div className="p-4" />
                <div className="p-4 text-center border-l" style={{ borderColor: 'oklch(1 0 0 / 0.06)' }}>
                  <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => navigate('/login')}>
                    Criar conta grátis
                  </Button>
                </div>
                <div className="p-4 text-center border-l" style={{ borderColor: 'oklch(1 0 0 / 0.06)' }}>
                  <Button size="sm" className="w-full text-xs" onClick={() => navigate('/login?plan=premium')}
                    style={{ background: 'oklch(0.6 0.2 210)', boxShadow: '0 0 20px oklch(0.6 0.2 210 / 0.4)' }}>
                    <Crown className="h-3 w-3 mr-1" />Assinar
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* PREMIUM SECTION */}
      <section className="py-20 relative">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 50% 40% at 50% 50%, oklch(0.55 0.18 60 / 0.04), transparent)' }} />
        <div className="container mx-auto px-5 max-w-4xl relative">
          <Reveal>
            <div className="rounded-3xl p-8 md:p-10 relative overflow-hidden"
              style={{
                background: 'oklch(1 0 0 / 0.03)',
                border: '1px solid oklch(0.65 0.18 50 / 0.2)',
                backdropFilter: 'blur(24px)',
                boxShadow: '0 8px 48px oklch(0 0 0 / 0.3), 0 0 80px oklch(0.65 0.18 50 / 0.06), inset 0 1px 0 oklch(1 0 0 / 0.08)',
              }}>
              <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, oklch(0.6 0.16 60 / 0.1), transparent)' }} />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, oklch(0.6 0.16 200 / 0.08), transparent)' }} />
              <div className="relative grid md:grid-cols-2 gap-10 items-center">
                <div className="space-y-6">
                  <div>
                    <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 mb-4">
                      <Crown className="h-3 w-3 mr-1.5" />Premium
                    </Badge>
                    <h2 className="text-3xl md:text-4xl font-black mb-3">
                      Leve seu surf ao<br />
                      <span className="text-yellow-400">próximo nível.</span>
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                      Menos que o combustível de uma ida até a praia errada — e você nunca mais vai chegar quando o mar estiver ruim.
                    </p>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { icon: BarChart3, title: 'Previsão 14 dias completa' },
                      { icon: Bell, title: 'Alertas quando seu spot estiver épico' },
                      { icon: TrendingUp, title: 'Histórico completo de condições' },
                      { icon: Shield, title: 'Experiência 100% sem anúncios' },
                      { icon: Zap, title: 'Acesso antecipado a novos recursos' },
                    ].map(({ icon: Icon, title }) => (
                      <div key={title} className="flex items-center gap-3">
                        <div className="h-6 w-6 rounded-lg bg-yellow-500/15 flex items-center justify-center flex-shrink-0">
                          <Icon className="h-3.5 w-3.5 text-yellow-400" />
                        </div>
                        <span className="text-sm font-medium">{title}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-center md:items-end gap-5">
                  <div className="text-center md:text-right">
                    <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Apenas</div>
                    <div className="flex items-end justify-center md:justify-end gap-1">
                      <span className="text-6xl font-black text-yellow-400 leading-none">29</span>
                      <div className="mb-1.5">
                        <div className="text-2xl font-black text-yellow-400">,90</div>
                        <div className="text-xs text-muted-foreground">R$/mês</div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Cancele quando quiser</div>
                  </div>
                  <Button size="lg" onClick={() => navigate('/login?plan=premium')}
                    className="w-full md:w-auto font-bold px-10 h-12 text-base group"
                    style={{
                      background: 'linear-gradient(135deg, oklch(0.7 0.18 60), oklch(0.6 0.22 50))',
                      color: 'oklch(0.1 0.02 240)',
                      boxShadow: '0 0 32px oklch(0.6 0.18 60 / 0.4)',
                    }}>
                    <Crown className="h-4 w-4 mr-2" />
                    Assinar Premium
                  </Button>
                  <div className="flex flex-wrap items-center justify-center md:justify-end gap-3">
                    {['Pagamento seguro', 'Sem fidelidade', 'Cancele quando quiser'].map(t => (
                      <span key={t} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-green-400" />{t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* INSTALAÇÃO PWA */}
      <section className="py-20 border-t border-border/30">
        <div className="container mx-auto px-5 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <Reveal className="space-y-6">
              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 px-4 py-1">
                <Smartphone className="h-3 w-3 mr-1.5" />
                Funciona como app nativo
              </Badge>
              <h2 className="text-3xl md:text-4xl font-black">
                Sem baixar nada.<br />
                <span className="text-primary">Vai direto pra tela inicial.</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                O Surf AI é um PWA — funciona igual a um app, sem ocupar espaço da loja. Acesse pelo Safari ou Chrome e adicione à tela inicial em segundos.
              </p>
              <div className="space-y-3">
                {[
                  { icon: Zap, text: 'Carregamento ultra rápido, mesmo com sinal fraco' },
                  { icon: Bell, text: 'Notificações push igual app nativo' },
                  { icon: Lock, text: 'Seguro e sem permissões desnecessárias' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">{text}</span>
                  </div>
                ))}
              </div>
              <Button onClick={() => navigate('/login')} className="font-bold bg-primary hover:bg-primary/90"
                style={{ boxShadow: '0 0 20px oklch(0.6 0.16 200 / 0.3)' }}>
                Acessar agora
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Reveal>

            <div className="flex flex-col gap-4">
              {[
                { step: '1', title: 'Abra no seu navegador', desc: 'Safari (iOS) ou Chrome (Android)', icon: Waves },
                { step: '2', title: 'Toque em "Adicionar à Tela Inicial"', desc: 'No menu de compartilhamento ou nos 3 pontinhos', icon: Smartphone },
                { step: '3', title: 'Pronto, é isso!', desc: 'Ícone na tela inicial, notificações ativas', icon: CheckCircle2 },
              ].map(({ step, title, desc, icon: Icon }, i) => (
                <Reveal key={step} delay={i * 0.12}>
                  <div className="flex items-center gap-4 rounded-xl p-4 transition-all duration-200 hover:scale-[1.01]"
                    style={{
                      background: 'oklch(1 0 0 / 0.025)',
                      border: '1px solid oklch(1 0 0 / 0.08)',
                      backdropFilter: 'blur(12px)',
                      boxShadow: '0 2px 16px oklch(0 0 0 / 0.12), inset 0 1px 0 oklch(1 0 0 / 0.05)',
                    }}>
                    <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-black text-primary flex-shrink-0">
                      {step}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{title}</div>
                      <div className="text-xs text-muted-foreground">{desc}</div>
                    </div>
                    <Icon className="h-5 w-5 text-primary/30 ml-auto flex-shrink-0" />
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 border-t border-border/30">
        <div className="container mx-auto px-5 max-w-2xl">
          <Reveal className="text-center mb-14">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-4 px-4 py-1">FAQ</Badge>
            <h2 className="text-3xl md:text-4xl font-black mb-4">Ainda com dúvida?<br />A gente responde.</h2>
            <p className="text-muted-foreground">Perguntas que todo surfista faz antes de baixar.</p>
          </Reveal>
          <div className="space-y-3">
            {FAQS.map(faq => <FAQItem key={faq.q} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 border-t border-border/30 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[120px] opacity-20"
            style={{ background: 'radial-gradient(ellipse, oklch(0.6 0.2 210), transparent 70%)' }} />
        </div>
        <div className="container mx-auto px-5 max-w-2xl text-center relative">
          <Reveal>
            <div className="rounded-3xl p-10 md:p-16 relative overflow-hidden"
              style={{
                background: 'oklch(1 0 0 / 0.025)',
                border: '1px solid oklch(0.6 0.2 210 / 0.25)',
                backdropFilter: 'blur(24px)',
                boxShadow: '0 8px 64px oklch(0 0 0 / 0.4), 0 0 120px oklch(0.6 0.2 210 / 0.12), inset 0 1px 0 oklch(1 0 0 / 0.1)',
              }}>
              <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, oklch(0.6 0.16 200 / 0.12), transparent)' }} />
              <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, oklch(0.55 0.18 280 / 0.08), transparent)' }} />
              <div className="relative">
                <div className="flex justify-center mb-6">
                  <AppLogo size={64} variant="icon" />
                </div>
                <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6 text-xs font-semibold"
                  style={{ background: 'oklch(0.6 0.2 210 / 0.12)', border: '1px solid oklch(0.6 0.2 210 / 0.3)', color: 'oklch(0.75 0.15 200)' }}>
                  <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                  17 praias monitoradas agora
                </div>
                <h2 className="text-3xl md:text-5xl font-black mb-4 leading-tight">
                  Sua próxima sessão épica<br />
                  <span className="text-transparent bg-clip-text"
                    style={{
                      backgroundImage: 'linear-gradient(135deg, oklch(0.75 0.16 200), oklch(0.5 0.2 220))',
                      backgroundSize: '200% 200%',
                      animation: 'gradientShift 4s ease infinite',
                    }}>
                    começa aqui.
                  </span>
                </h2>
                <p className="text-muted-foreground mb-10 leading-relaxed text-base max-w-md mx-auto">
                  Dados reais de 17 praias, score de IA e alertas personalizados.
                  Crie sua conta grátis em menos de 1 minuto.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
                  <Button size="lg" onClick={() => navigate('/login')}
                    className="font-bold px-10 h-12 text-base relative overflow-hidden group"
                    style={{
                      background: 'oklch(0.6 0.2 210)',
                      boxShadow: '0 0 40px oklch(0.6 0.2 210 / 0.6), 0 0 80px oklch(0.6 0.2 210 / 0.2), inset 0 1px 0 oklch(1 0 0 / 0.15)',
                    }}>
                    Criar conta gratuita
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate('/login?plan=premium')}
                    className="font-bold px-8 h-12"
                    style={{ borderColor: 'oklch(0.65 0.18 50 / 0.4)', color: 'oklch(0.7 0.15 50)' }}>
                    <Crown className="h-4 w-4 mr-2" />
                    Ver plano Premium
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-6 mb-8">
                  {['Grátis para começar', 'Sem cartão de crédito', 'Funciona no iPhone e Android'].map(t => (
                    <span key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />{t}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-3 mb-8">
                  <div className="flex -space-x-2">
                    {['LT', 'AF', 'BM', 'RS', '+'].map((initials, i) => (
                      <div key={i} className="h-7 w-7 rounded-full border-2 border-background flex items-center justify-center text-[8px] font-black"
                        style={{ background: i < 4 ? `oklch(${0.5 + i * 0.04} 0.12 ${200 + i * 30})` : 'oklch(0.3 0.04 240)', color: 'white' }}>
                        {initials}
                      </div>
                    ))}
                  </div>
                  <div className="text-left">
                    <div className="flex gap-0.5 mb-0.5">
                      {[1,2,3,4,5].map(i => <Star key={i} className="h-3 w-3 text-yellow-400 fill-yellow-400" />)}
                    </div>
                    <p className="text-xs text-muted-foreground">Os primeiros surfistas adoraram</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4 pt-6 border-t border-border/30">
                  {[
                    { icon: Lock, label: 'Pagamento seguro' },
                    { icon: Shield, label: 'Seus dados protegidos' },
                    { icon: CheckCircle2, label: 'Cancele quando quiser' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                      <Icon className="h-3 w-3" />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8"
        style={{ borderTop: '1px solid oklch(1 0 0 / 0.06)', background: 'oklch(1 0 0 / 0.015)', backdropFilter: 'blur(20px)' }}>
        <div className="container mx-auto px-5 max-w-5xl flex flex-col md:flex-row items-center justify-between gap-4">
          <AppLogo size={30} variant="full" />
          <div className="text-xs text-muted-foreground text-center">
            Florianópolis, SC · Dados atualizados a cada hora · Feito com 🤙 para surfistas
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/privacy')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Privacidade
            </button>
            <button onClick={() => navigate('/login')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Entrar
            </button>
            <Button size="sm" variant="outline" onClick={() => navigate('/login')}
              className="text-xs border-primary/30 hover:bg-primary/5 hover:border-primary/50">
              Começar grátis
            </Button>
          </div>
        </div>
      </footer>

      {/* CTA FLUTUANTE */}
      <FloatingCTA onFree={() => navigate('/login')} onPremium={() => navigate('/login?plan=premium')} />

    </div>
  )
}
