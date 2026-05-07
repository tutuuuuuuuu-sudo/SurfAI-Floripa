import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Waves, Zap, Bell, BarChart3, Clock, Shield,
  ArrowRight, CheckCircle2, Wind, TrendingUp,
  MapPin, Crown, ChevronRight, ChevronDown, X, Check,
  Star, Quote, Droplets, Timer, Flame, Lock,
  Smartphone
} from 'lucide-react'

// ─── Dados ───────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Zap, title: 'Score de IA em tempo real', desc: 'IA analisa altura, período, vento e maré para gerar uma nota de 0 a 10 para cada praia.', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20' },
  { icon: MapPin, title: '17 praias monitoradas', desc: 'Cobertura completa de Florianópolis — Santinho ao Naufragados, todas as 4 regiões.', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
  { icon: BarChart3, title: 'Previsão de 14 dias', desc: 'Planeje com antecedência. Dados de ondas, vento e maré para as próximas 2 semanas.', color: 'text-violet-400', bg: 'bg-violet-400/10', border: 'border-violet-400/20' },
  { icon: Bell, title: 'Alertas personalizados', desc: 'Seja notificado quando seu spot favorito atingir o score que você definiu.', color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20' },
  { icon: Clock, title: 'Histórico e tendências', desc: 'Veja as condições dos últimos dias e identifique os melhores padrões de swell.', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20' },
  { icon: Waves, title: 'Log de sessões', desc: 'Registre suas sessões, dê notas, anote memórias. Seu diário de surf digital.', color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/20' },
]

const TESTIMONIALS = [
  { name: 'Lucas T.', role: 'Intermediário · Coqueiros', avatar: 'LT', stars: 5, text: 'Fui na Mole ontem cedo, o score tava 8.4. Mar perfeito, quase vazio. Antes eu ia no achismo e voltava bastante frustrado. Agora pelo menos sei antes de sair de casa.' },
  { name: 'Ana F.', role: 'Iniciante · Norte da ilha', avatar: 'AF', stars: 4, text: 'Pra mim que sou iniciante foi ótimo porque sempre fui na praia errada. Agora olho quais tão mais calmas e vou pra lá. Simples assim. Não perco mais tempo.' },
  { name: 'Bruno M.', role: 'Surfista · Campeche', avatar: 'BM', stars: 5, text: 'Usei pra planejar a semana de folga. Dos 6 dias que fui, 5 o mar tava bom mesmo. Não é 100% mas bem melhor do que depender de grupo de WhatsApp.' },
  { name: 'Rafael S.', role: 'Avançado · Joaquina', avatar: 'RS', stars: 5, text: 'O alerta de ondas mudou meu jogo. Acordo com a notificação, chego no pico quando ainda tá vazio. Melhor investimento do mês.' },
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

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function CountdownTimer() {
  const [time, setTime] = useState({ h: 2, m: 47, s: 33 })

  useEffect(() => {
    const t = setInterval(() => {
      setTime(prev => {
        let { h, m, s } = prev
        s--
        if (s < 0) { s = 59; m-- }
        if (m < 0) { m = 59; h-- }
        if (h < 0) { h = 2; m = 47; s = 33 }
        return { h, m, s }
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex items-center gap-1.5 text-yellow-400 font-mono font-bold text-sm">
      <Timer className="h-3.5 w-3.5" />
      <span>{String(time.h).padStart(2, '0')}:{String(time.m).padStart(2, '0')}:{String(time.s).padStart(2, '0')}</span>
    </div>
  )
}

function SocialProofBar() {
  const [count, setCount] = useState(247)

  useEffect(() => {
    const t = setInterval(() => {
      setCount(c => c + (Math.random() > 0.7 ? 1 : 0))
    }, 8000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="sticky top-0 z-[60] py-2 px-4 text-center text-xs font-semibold flex items-center justify-center gap-2"
      style={{ background: 'oklch(0.55 0.16 200)', color: 'white' }}>
      <Flame className="h-3.5 w-3.5 flex-shrink-0" />
      <span>
        <span className="font-black">{count} surfistas</span> estão usando agora · Acesso gratuito disponível
      </span>
      <Flame className="h-3.5 w-3.5 flex-shrink-0" />
    </div>
  )
}

function AppMockup() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setActive(p => (p + 1) % MOCK_SPOTS.length), 2200)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="relative mx-auto select-none" style={{ width: 260, height: 540 }}>
      {/* Glow de fundo */}
      <div className="absolute inset-[-20px] rounded-[60px] blur-3xl opacity-25 pointer-events-none"
        style={{ background: `radial-gradient(ellipse, ${MOCK_SPOTS[active].color}, transparent 70%)`, transition: 'background 0.8s ease' }} />

      {/* Frame do celular */}
      <div className="relative w-full h-full rounded-[38px] overflow-hidden shadow-2xl"
        style={{ border: '2px solid oklch(0.35 0.06 240)', background: 'oklch(0.12 0.02 240)' }}>

        {/* Dynamic island / notch */}
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-6 rounded-full z-20 flex items-center justify-center gap-1.5"
          style={{ background: 'oklch(0.08 0.01 240)' }}>
          <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'oklch(0.4 0.08 200)' }} />
          <div className="h-2 w-2 rounded-full" style={{ background: 'oklch(0.3 0.06 240)' }} />
        </div>

        {/* Status bar */}
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

        {/* App header */}
        <div className="px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-xl flex items-center justify-center"
              style={{ background: 'oklch(0.6 0.16 200 / 0.2)' }}>
              <Waves className="h-4 w-4" style={{ color: 'oklch(0.6 0.16 200)' }} />
            </div>
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

        {/* Melhor pico card */}
        <div className="mx-3 mb-3 rounded-2xl p-3.5 relative overflow-hidden"
          style={{
            background: `${MOCK_SPOTS[active].color}18`,
            border: `1px solid ${MOCK_SPOTS[active].color}35`,
            transition: 'background 0.6s ease, border-color 0.6s ease'
          }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 80% 50%, ${MOCK_SPOTS[active].color}15, transparent)` }} />
          <div className="text-[8px] font-bold uppercase tracking-wider mb-1.5"
            style={{ color: MOCK_SPOTS[active].color, transition: 'color 0.6s ease' }}>
            Melhor pico agora
          </div>
          <div className="flex items-end justify-between relative">
            <div>
              <div className="text-[15px] font-black text-white leading-tight"
                style={{ transition: 'all 0.4s ease' }}>
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
              <div className="text-[30px] font-black leading-none"
                style={{ color: MOCK_SPOTS[active].color, transition: 'color 0.6s ease' }}>
                {MOCK_SPOTS[active].score}
              </div>
              <div className="text-[8px] font-bold"
                style={{ color: MOCK_SPOTS[active].color }}>
                {MOCK_SPOTS[active].label}
              </div>
            </div>
          </div>
        </div>

        {/* Lista de praias */}
        <div className="px-3">
          <div className="text-[8px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'oklch(0.45 0.02 220)' }}>
            Todas as praias
          </div>
          <div className="space-y-1.5">
            {MOCK_SPOTS.map((spot, i) => (
              <div key={spot.beach}
                className="flex items-center justify-between rounded-xl px-3 py-2 transition-all duration-300"
                style={{
                  background: i === active
                    ? `${spot.color}18`
                    : 'oklch(0.18 0.02 240)',
                  border: `1px solid ${i === active ? spot.color + '40' : 'oklch(0.28 0.03 240)'}`,
                }}>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                    style={{ background: spot.color }} />
                  <div>
                    <div className="text-[10px] font-semibold text-white">{spot.beach}</div>
                    <div className="text-[8px] text-white/40">{spot.wave} · {spot.period}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-black leading-none" style={{ color: spot.color }}>
                    {spot.score}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom nav mockup */}
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

      {/* Dot indicators */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
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

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-border/50 rounded-2xl overflow-hidden transition-all duration-200 hover:border-primary/30">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-card/60 transition-colors"
        aria-expanded={open}
      >
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

function FloatingCTA({ onClick }: { onClick: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
      <Button size="lg" onClick={onClick}
        className="font-bold px-8 h-12 text-sm shadow-2xl bg-primary hover:bg-primary/90 rounded-full"
        style={{ boxShadow: '0 0 32px oklch(0.6 0.16 200 / 0.5), 0 8px 24px rgba(0,0,0,0.4)' }}>
        Criar conta grátis
        <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* BARRA DE PROVA SOCIAL */}
      <SocialProofBar />

      {/* NAV */}
      <nav className="sticky top-8 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="container mx-auto px-5 py-3 flex items-center justify-between max-w-6xl">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center"
              style={{ background: 'oklch(0.6 0.16 200 / 0.15)', border: '1px solid oklch(0.6 0.16 200 / 0.3)' }}>
              <Waves className="h-4.5 w-4.5 text-primary" />
            </div>
            <span className="font-black text-lg tracking-tight">Surf AI</span>
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
      <section className="relative pt-16 pb-20 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-3xl opacity-20"
            style={{ background: 'radial-gradient(ellipse, oklch(0.6 0.16 200), transparent 70%)' }} />
          <div className="absolute bottom-0 right-0 w-[400px] h-[300px] rounded-full blur-3xl opacity-10"
            style={{ background: 'radial-gradient(ellipse, oklch(0.7 0.18 280), transparent 70%)' }} />
        </div>

        <div className="container mx-auto px-5 max-w-6xl relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Texto */}
            <div className="space-y-7">
              <div className="flex flex-wrap gap-2">
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
                <h1 className="text-5xl md:text-6xl font-black leading-[1.05] tracking-tight">
                  O surf de{' '}
                  <span className="relative">
                    <span className="text-transparent bg-clip-text"
                      style={{ backgroundImage: 'linear-gradient(135deg, oklch(0.75 0.16 200), oklch(0.5 0.2 220))' }}>
                      Floripa
                    </span>
                    <svg className="absolute -bottom-1 left-0 w-full" height="4" viewBox="0 0 100 4" preserveAspectRatio="none">
                      <path d="M0,2 Q25,0 50,2 Q75,4 100,2" stroke="oklch(0.6 0.16 200)" strokeWidth="2" fill="none" strokeLinecap="round" />
                    </svg>
                  </span>
                  <br />na palma da mão.
                </h1>
                <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                  Score de IA para 17 praias. Previsão de ondas, alertas e histórico —
                  tudo que você precisa para não perder a melhor sessão da semana.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" onClick={() => navigate('/login')}
                  className="text-base font-bold px-8 h-12 bg-primary hover:bg-primary/90 flex-1 sm:flex-none"
                  style={{ boxShadow: '0 0 32px oklch(0.6 0.16 200 / 0.4)' }}>
                  Criar conta grátis
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/login?plan=premium')}
                  className="text-base font-bold px-8 h-12 border-yellow-500/40 hover:border-yellow-500/60 hover:bg-yellow-500/5 flex-1 sm:flex-none">
                  <Crown className="h-4 w-4 mr-2 text-yellow-400" />
                  Ver Premium
                </Button>
              </div>

              <div className="flex flex-wrap gap-4">
                {['Grátis para começar', 'Sem cartão de crédito', 'Instala em 1 minuto'].map(t => (
                  <span key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />{t}
                  </span>
                ))}
              </div>

              {/* Mini prova social no hero */}
              <div className="flex items-center gap-3 pt-1">
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
                  <p className="text-xs text-muted-foreground">+200 surfistas de Floripa já usam</p>
                </div>
              </div>
            </div>

            {/* Mockup do celular */}
            <div className="flex justify-center lg:justify-end pt-8 pb-10">
              <AppMockup />
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-10 border-y border-border/40">
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
          <div className="text-center mb-12">
            <Badge variant="outline" className="border-red-500/30 text-red-400 bg-red-500/5 mb-4 px-4 py-1">
              Reconhece alguma situação?
            </Badge>
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              Chegar na praia e o mar estar péssimo<br />
              <span className="text-muted-foreground font-medium text-2xl">é frustrante — e evitável.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {PAIN_POINTS.map(({ emoji, problem, solution }) => (
              <div key={problem} className="rounded-2xl border border-border/50 bg-card/40 p-6 space-y-4">
                <div className="text-3xl">{emoji}</div>
                <div>
                  <p className="text-sm font-semibold text-foreground/80 mb-3 line-through decoration-red-400/60">{problem}</p>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-green-400 font-semibold">{solution}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="py-20 border-t border-border/30">
        <div className="container mx-auto px-5 max-w-5xl">
          <div className="text-center mb-14">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-4 px-4 py-1">
              Como funciona
            </Badge>
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              Enquanto você lê isso, tem gente<br />surfando na praia certa.
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">Em menos de 1 minuto você sabe se vale sair de casa — sem chute, sem grupo de WhatsApp, sem frustração.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-12 left-[calc(16.67%+16px)] right-[calc(16.67%+16px)] h-px"
              style={{ background: 'linear-gradient(90deg, oklch(0.6 0.16 200 / 0.5), oklch(0.6 0.16 200 / 0.2))' }} />

            {[
              { step: '01', icon: Droplets, title: 'Dados em tempo real', desc: 'Coletamos dados de ondas, vento e maré de múltiplas fontes meteorológicas a cada hora, 24/7.' },
              { step: '02', icon: Zap, title: 'IA calcula o score', desc: 'Nossa IA analisa todos os parâmetros e gera uma nota de 0 a 10 considerando o seu nível de surf.' },
              { step: '03', icon: TrendingUp, title: 'Você decide em segundos', desc: 'Veja o score, compare praias e tome a melhor decisão — sem desperdício de tempo ou gasolina.' },
            ].map(({ step, icon: Icon, title, desc }, i) => (
              <div key={step} className="relative flex flex-col items-center text-center">
                <div className="relative mb-5">
                  <div className="h-16 w-16 rounded-2xl flex items-center justify-center relative z-10"
                    style={{
                      background: 'oklch(0.6 0.16 200 / 0.1)',
                      border: '2px solid oklch(0.6 0.16 200 / 0.4)',
                      boxShadow: '0 0 24px oklch(0.6 0.16 200 / 0.15)'
                    }}>
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black"
                    style={{ background: 'oklch(0.6 0.16 200)', color: 'white' }}>
                    {i + 1}
                  </div>
                </div>
                {i < 2 && (
                  <ChevronRight className="md:hidden absolute right-0 top-6 h-5 w-5 text-primary/30" />
                )}
                <h3 className="font-bold text-base mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 border-t border-border/30">
        <div className="container mx-auto px-5 max-w-5xl">
          <div className="text-center mb-14">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-4 px-4 py-1">Funcionalidades</Badge>
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              Pare de adivinhar.<br />Comece a surfar na hora certa.
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Feito por surfistas, para surfistas. Dados reais, análise inteligente, decisão rápida.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc, color, bg, border }) => (
              <div key={title}
                className="group rounded-2xl border bg-card/50 p-6 hover:bg-card transition-all duration-300 cursor-default"
                style={{ borderColor: 'oklch(0.3 0.03 240)' }}>
                <div className={`h-11 w-11 rounded-xl ${bg} border ${border} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <h3 className="font-bold text-base mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section className="py-20 border-t border-border/30">
        <div className="container mx-auto px-5 max-w-5xl">
          <div className="text-center mb-14">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-4 px-4 py-1">Depoimentos</Badge>
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              Todo dia alguém chega na praia<br />na hora certa por causa disso.
            </h2>
            <div className="flex items-center justify-center gap-1 mb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
              ))}
              <span className="text-sm text-muted-foreground ml-2">5.0 · Avaliado pelos surfistas de Floripa</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {TESTIMONIALS.map(({ name, role, avatar, stars, text }) => (
              <div key={name}
                className="rounded-2xl border border-border/50 bg-card/60 p-6 flex flex-col gap-4 hover:border-primary/30 hover:bg-card transition-all duration-300">
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
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARATIVO PLANOS */}
      <section className="py-20 border-t border-border/30">
        <div className="container mx-auto px-5 max-w-3xl">
          <div className="text-center mb-14">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-4 px-4 py-1">Planos</Badge>
            <h2 className="text-3xl md:text-4xl font-black mb-4">Quanto custa perder<br />uma sessão épica?</h2>
            <p className="text-muted-foreground">Comece grátis. Upgrade quando quiser — sem complicação.</p>
          </div>

          <div className="rounded-2xl border border-border/50 overflow-hidden">
            <div className="grid grid-cols-3 bg-card/80 border-b border-border/50">
              <div className="p-4 text-sm font-semibold text-muted-foreground">Recurso</div>
              <div className="p-4 text-center border-l border-border/50">
                <div className="text-sm font-bold">Grátis</div>
                <div className="text-xs text-muted-foreground">R$ 0</div>
              </div>
              <div className="p-4 text-center border-l border-border/50 relative"
                style={{ background: 'oklch(0.6 0.16 200 / 0.08)' }}>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground text-[9px] px-2 py-0.5 font-black">POPULAR</Badge>
                </div>
                <div className="text-sm font-bold text-primary flex items-center justify-center gap-1.5">
                  <Crown className="h-3.5 w-3.5 text-yellow-400" />Premium
                </div>
                <div className="text-xs text-yellow-400 font-semibold">R$ 29,90/mês</div>
              </div>
            </div>

            {PLAN_FEATURES.map(({ label, free, premium }, i) => (
              <div key={label}
                className={`grid grid-cols-3 border-b border-border/30 last:border-0 ${i % 2 === 0 ? '' : 'bg-card/30'}`}>
                <div className="p-4 text-sm text-muted-foreground">{label}</div>
                <div className="p-4 text-center border-l border-border/30 flex items-center justify-center">
                  <PlanCell value={free} />
                </div>
                <div className="p-4 text-center border-l border-border/30 flex items-center justify-center"
                  style={{ background: 'oklch(0.6 0.16 200 / 0.04)' }}>
                  <PlanCell value={premium} />
                </div>
              </div>
            ))}

            <div className="grid grid-cols-3 bg-card/60 border-t border-border/50">
              <div className="p-4" />
              <div className="p-4 text-center border-l border-border/50">
                <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => navigate('/login')}>
                  Criar conta grátis
                </Button>
              </div>
              <div className="p-4 text-center border-l border-border/50">
                <Button size="sm" className="w-full text-xs bg-primary hover:bg-primary/90"
                  onClick={() => navigate('/login?plan=premium')}
                  style={{ boxShadow: '0 0 16px oklch(0.6 0.16 200 / 0.3)' }}>
                  <Crown className="h-3 w-3 mr-1" />Assinar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PREMIUM SECTION */}
      <section className="py-20 relative">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 50% 40% at 50% 50%, oklch(0.55 0.18 60 / 0.04), transparent)' }} />
        <div className="container mx-auto px-5 max-w-4xl relative">
          <div className="rounded-3xl border border-yellow-500/20 p-8 md:p-10 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, oklch(0.18 0.02 240), oklch(0.2 0.04 230))' }}>
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
                    Por menos que uma garrafa de Gatorade por dia — acesse todas as ferramentas de um surfista de alto nível.
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

                {/* Urgência no premium */}
                <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-center md:text-right">
                  <div className="text-xs text-yellow-400 font-semibold mb-1">Oferta por tempo limitado</div>
                  <CountdownTimer />
                </div>

                <Button size="lg" onClick={() => navigate('/login?plan=premium')}
                  className="w-full md:w-auto font-bold px-10 h-12 text-base"
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
        </div>
      </section>

      {/* INSTALAÇÃO PWA */}
      <section className="py-20 border-t border-border/30">
        <div className="container mx-auto px-5 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
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
            </div>

            {/* Visual de instalação */}
            <div className="flex flex-col gap-4">
              {[
                { step: '1', title: 'Abra no seu navegador', desc: 'Safari (iOS) ou Chrome (Android)', icon: Waves },
                { step: '2', title: 'Toque em "Adicionar à Tela Inicial"', desc: 'No menu de compartilhamento ou nos 3 pontinhos', icon: Smartphone },
                { step: '3', title: 'Pronto, é isso!', desc: 'Ícone na tela inicial, notificações ativas', icon: CheckCircle2 },
              ].map(({ step, title, desc, icon: Icon }) => (
                <div key={step} className="flex items-center gap-4 rounded-xl border border-border/40 bg-card/40 p-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-black text-primary flex-shrink-0">
                    {step}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{title}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                  <Icon className="h-5 w-5 text-primary/30 ml-auto flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 border-t border-border/30">
        <div className="container mx-auto px-5 max-w-2xl">
          <div className="text-center mb-14">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-4 px-4 py-1">FAQ</Badge>
            <h2 className="text-3xl md:text-4xl font-black mb-4">Ainda com dúvida?<br />A gente responde.</h2>
            <p className="text-muted-foreground">Perguntas que todo surfista faz antes de baixar.</p>
          </div>
          <div className="space-y-3">
            {FAQS.map(faq => <FAQItem key={faq.q} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 border-t border-border/30">
        <div className="container mx-auto px-5 max-w-2xl text-center">
          <div className="rounded-3xl p-10 md:p-14 border border-primary/20 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, oklch(0.18 0.04 220 / 0.9), oklch(0.16 0.06 210 / 0.9))',
              boxShadow: '0 0 80px oklch(0.6 0.16 200 / 0.08)',
            }}>
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, oklch(0.6 0.16 200 / 0.1), transparent)' }} />
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: 'oklch(0.6 0.16 200 / 0.15)', border: '2px solid oklch(0.6 0.16 200 / 0.3)' }}>
                <Waves className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-3xl md:text-4xl font-black mb-4">
                Pronto para surfar<br />com inteligência?
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Crie sua conta grátis agora e nunca mais chegue na praia
                com o mar ruim. Upgrade para Premium quando quiser.
              </p>
              <Button size="lg" onClick={() => navigate('/login')}
                className="font-bold px-10 h-12 text-base bg-primary hover:bg-primary/90"
                style={{ boxShadow: '0 0 32px oklch(0.6 0.16 200 / 0.4)' }}>
                Criar conta gratuita
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <div className="flex items-center justify-center gap-6 mt-6">
                {['Grátis para sempre', 'Sem cartão', 'Setup em 1 min'].map(t => (
                  <span key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />{t}
                  </span>
                ))}
              </div>

              {/* Segurança no CTA final */}
              <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-border/30">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                  <Lock className="h-3 w-3" />
                  <span>Pagamento seguro</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                  <Shield className="h-3 w-3" />
                  <span>Seus dados protegidos</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Sem compromisso</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/30 py-8">
        <div className="container mx-auto px-5 max-w-5xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center"
              style={{ background: 'oklch(0.6 0.16 200 / 0.15)', border: '1px solid oklch(0.6 0.16 200 / 0.25)' }}>
              <Waves className="h-4 w-4 text-primary" />
            </div>
            <span className="font-black text-sm">Surf AI</span>
          </div>
          <div className="text-xs text-muted-foreground text-center">
            Florianópolis, SC · Dados atualizados a cada hora · Feito com 🤙 para surfistas
          </div>
          <div className="flex items-center gap-3">
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
      <FloatingCTA onClick={() => navigate('/login')} />

    </div>
  )
}
