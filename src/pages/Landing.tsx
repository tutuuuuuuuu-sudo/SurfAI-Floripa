import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Waves, Zap, Bell, BarChart3, Clock, Shield,
  ArrowRight, CheckCircle2, TrendingUp,
  MapPin, Crown, ChevronRight, Droplets,
  Smartphone,
} from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'
import {
  AnimatedNumber,
  FAQItem, Reveal, FloatingCTA,
} from '@/components/landing/LandingComponents'
import { AppScrollShowcase } from '@/components/landing/AppScrollShowcase'
import { WaveScrollHero } from '@/components/landing/WaveScrollHero'
import { BeachDirectory } from '@/components/landing/BeachDirectory'
import {
  FAQS, STATS,
} from '@/components/landing/landingData'
import { BEACH_DIRECTORY } from '@/lib/beachDirectory'

const BEACH_COUNT = BEACH_DIRECTORY.length

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-clip relative">

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
            <Button variant="ghost" size="sm" asChild
              className="text-sm text-muted-foreground hover:text-foreground">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button size="sm" asChild
              className="text-sm font-bold px-4 bg-primary hover:bg-primary/90"
              style={{ boxShadow: '0 0 16px oklch(0.6 0.16 200 / 0.25)' }}>
              <Link to="/login">
                Começar grátis
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* HERO — vídeo real de onda quebrando, scroll controla o avanço */}
      <WaveScrollHero>
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 sm:gap-4">
          <div className="flex flex-wrap justify-center gap-2" style={{ animation: 'fadeIn 0.6s ease both' }}>
            <Badge variant="outline" className="border-primary/40 text-primary bg-black/30 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <Zap className="h-3 w-3 mr-1.5 fill-current" />
              Inteligência Artificial
            </Badge>
            <Badge variant="outline" className="border-rating-good/40 text-rating-good bg-black/30 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <Waves className="h-3 w-3 mr-1.5" />
              Dados em tempo real
            </Badge>
          </div>

          <h1 className="text-5xl md:text-6xl font-black leading-[1.05] tracking-tight text-white overflow-hidden"
            style={{ textShadow: '0 2px 24px oklch(0 0 0 / 0.4)' }}>
            <span className="block" style={{ animation: 'textReveal 0.7s ease 0.1s both' }}>
              O surf de{' '}
              <span className="relative inline-block">
                <span className="text-transparent bg-clip-text"
                  style={{
                    backgroundImage: 'linear-gradient(135deg, oklch(0.75 0.16 200), oklch(0.6 0.2 200))',
                  }}>
                  Floripa
                </span>
              </span>
            </span>
            <span className="block" style={{ animation: 'textReveal 0.7s ease 0.25s both' }}>
              na palma da mão.
            </span>
          </h1>
          <p className="text-lg text-white/90 max-w-lg leading-relaxed"
            style={{ animation: 'fadeIn 0.7s ease 0.4s both', textShadow: '0 2px 10px oklch(0 0 0 / 0.85), 0 1px 3px oklch(0 0 0 / 0.9)' }}>
            Nota de IA para {BEACH_COUNT} praias. Previsão de ondas, alertas e histórico:
            tudo que você precisa para não perder a melhor sessão da semana.
          </p>

          <div className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-base sm:text-lg font-black text-white backdrop-blur-md"
            style={{
              animation: 'fadeIn 0.7s ease 0.45s both',
              background: 'oklch(0.6 0.16 200 / 0.28)',
              border: '1.5px solid oklch(0.7 0.16 200 / 0.7)',
              boxShadow: '0 0 32px oklch(0.6 0.16 200 / 0.4), inset 0 1px 0 oklch(1 0 0 / 0.15)',
            }}>
            Feito por surfistas,{' '}
            <span className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, oklch(0.85 0.16 200), oklch(0.9 0.14 160))' }}>
              para surfistas.
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3" style={{ animation: 'slideUp 0.6s ease 0.5s both' }}>
            <Button size="lg" asChild
              className="text-base font-bold px-8 h-12 flex-1 sm:flex-none relative overflow-hidden group"
              style={{
                background: 'oklch(0.6 0.2 210)',
                boxShadow: '0 0 40px oklch(0.6 0.2 210 / 0.5), 0 0 80px oklch(0.6 0.2 210 / 0.2), inset 0 1px 0 oklch(1 0 0 / 0.15)',
              }}>
              <Link to="/login">
                <span className="relative z-10 flex items-center gap-2">
                  Criar conta grátis
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild
              className="text-base font-bold px-8 h-12 flex-1 sm:flex-none text-white border-white/40 hover:bg-white/10"
              style={{ background: 'oklch(1 0 0 / 0.06)', backdropFilter: 'blur(12px)' }}>
              <Link to="/login?plan=premium">
                <Crown className="h-4 w-4 mr-2 text-rating-fair" />
                Ver Premium
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-2" style={{ animation: 'fadeIn 0.6s ease 0.65s both' }}>
            {['Grátis para começar', 'Sem cartão de crédito', 'Instala em 1 minuto'].map(t => (
              <span key={t} className="flex items-center gap-1.5 text-xs font-medium text-white/90 bg-black/30 backdrop-blur-md rounded-full px-2.5 py-1 border border-white/10">
                <CheckCircle2 className="h-3.5 w-3.5 text-rating-good flex-shrink-0" />{t}
              </span>
            ))}
          </div>
        </div>
      </WaveScrollHero>

      {/* O APP RODANDO — celular fixo, conteúdo troca conforme rola o scroll */}
      <section className="py-16 border-t border-border/30 relative z-10">
        <div className="container mx-auto px-5 max-w-5xl">
          <Reveal className="text-center mb-4 md:mb-10">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-4 px-4 py-1">
              Rola pra ver
            </Badge>
            <h2 className="text-2xl md:text-4xl font-black">
              Veja como é usar o Surf AI.
            </h2>
          </Reveal>
          <AppScrollShowcase />
        </div>
      </section>

      {/* TODAS AS PRAIAS — prova social honesta: cobertura real, sem depoimento inventado */}
      <section className="py-20 border-t border-border/30 relative z-10">
        <div className="container mx-auto px-5 max-w-4xl">
          <Reveal className="text-center mb-10">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-4 px-4 py-1">
              Cobertura real
            </Badge>
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              {BEACH_COUNT} praias. A ilha inteira.
            </h2>
            <p className="text-foreground/70 max-w-md mx-auto">
              Do Santinho ao Naufragados, ponta a ponta da ilha. Cada pico monitorado com nome e localização reais.
            </p>
          </Reveal>
          <BeachDirectory />
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
            <p className="text-foreground/70 max-w-md mx-auto">Em menos de 1 minuto você sabe se vale sair de casa: sem chute, sem grupo de WhatsApp, sem frustração.</p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 relative">
            {[
              { step: '01', icon: Droplets, title: 'Dados em tempo real', desc: 'Coletamos dados de ondas, vento e maré de múltiplas fontes meteorológicas a cada 15 minutos, 24/7.', hue: 220 },
              { step: '02', icon: Zap, title: 'IA calcula a nota', desc: 'Nossa IA analisa todos os parâmetros e gera uma nota de 0 a 10 considerando o seu nível de surf.', hue: 195 },
              { step: '03', icon: TrendingUp, title: 'Você decide em segundos', desc: 'Veja a nota, compare praias e tome a melhor decisão, sem desperdício de tempo ou gasolina.', hue: 155 },
            ].map(({ step, icon: Icon, title, desc, hue }, i) => (
              <Reveal key={step} delay={i * 0.15}>
                <div className="relative flex flex-col h-full rounded-2xl p-6 overflow-hidden"
                  style={{
                    background: `oklch(0.6 0.18 ${hue} / 0.07)`,
                    border: `1px solid oklch(0.6 0.18 ${hue} / 0.25)`,
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 4px 24px oklch(0 0 0 / 0.15), inset 0 1px 0 oklch(1 0 0 / 0.06)',
                  }}>
                  <span className="pointer-events-none select-none absolute -top-3 -right-1 font-black leading-none"
                    style={{ fontSize: '6.5rem', color: `oklch(0.6 0.18 ${hue} / 0.12)` }}>
                    {step}
                  </span>
                  <div className="relative z-10 h-14 w-14 rounded-2xl flex items-center justify-center mb-5"
                    style={{
                      background: `oklch(0.6 0.18 ${hue} / 0.15)`,
                      border: `1px solid oklch(0.6 0.18 ${hue} / 0.45)`,
                      boxShadow: `0 0 28px oklch(0.6 0.18 ${hue} / 0.3)`,
                    }}>
                    <Icon className="h-6 w-6" style={{ color: `oklch(0.6 0.18 ${hue})` }} />
                  </div>
                  <h3 className="relative z-10 font-bold text-lg mb-2">{title}</h3>
                  <p className="relative z-10 text-sm text-foreground/70 leading-relaxed">{desc}</p>
                  {i < 2 && (
                    <ChevronRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-6 w-6"
                      style={{ color: `oklch(0.6 0.18 ${hue} / 0.5)` }} />
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* MAIS RECURSOS — cada card usa uma cor do próprio sistema de rating do app */}
      <section className="py-20 border-t border-border/30">
        <div className="container mx-auto px-5 max-w-5xl">
          <Reveal className="text-center mb-14">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-4 px-4 py-1">Funcionalidades</Badge>
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              Pare de adivinhar.<br />Comece a surfar na hora certa.
            </h2>
            <p className="text-foreground/70 text-lg max-w-xl mx-auto">
              E tem mais: histórico, diário de surf e cobertura completa da ilha.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-6">
            <Reveal delay={0}>
              <div className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl p-6 bg-rating-excellent/[0.06] border border-rating-excellent/25 transition-transform duration-300 hover:-translate-y-1"
                style={{ boxShadow: '0 4px 24px oklch(0 0 0 / 0.12)' }}>
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rating-excellent/15 border border-rating-excellent/30">
                    <MapPin className="h-6 w-6 text-rating-excellent" />
                  </div>
                  <div className="text-right leading-none">
                    <div className="text-3xl font-black text-rating-excellent">{BEACH_COUNT}</div>
                    <div className="text-[10px] uppercase tracking-wider text-foreground/40">praias</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-base mb-1.5">{BEACH_COUNT} praias monitoradas</h3>
                  <p className="text-sm text-foreground/60 leading-relaxed">Cobertura completa de Florianópolis, do Santinho ao Naufragados.</p>
                </div>
                <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-rating-excellent/10 blur-2xl pointer-events-none" />
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl p-6 bg-rating-fair/[0.06] border border-rating-fair/25 transition-transform duration-300 hover:-translate-y-1"
                style={{ boxShadow: '0 4px 24px oklch(0 0 0 / 0.12)' }}>
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rating-fair/15 border border-rating-fair/30">
                    <Clock className="h-6 w-6 text-rating-fair" />
                  </div>
                  <div className="text-right leading-none">
                    <div className="text-3xl font-black text-rating-fair">30</div>
                    <div className="text-[10px] uppercase tracking-wider text-foreground/40">dias</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-base mb-1.5">Histórico de condições</h3>
                  <p className="text-sm text-foreground/60 leading-relaxed">30 dias de ondas e vento por praia — saiba se hoje é dia bom antes de sair de casa.</p>
                </div>
                <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-rating-fair/10 blur-2xl pointer-events-none" />
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl p-6 bg-rating-epic/[0.06] border border-rating-epic/25 transition-transform duration-300 hover:-translate-y-1"
                style={{ boxShadow: '0 4px 24px oklch(0 0 0 / 0.12)' }}>
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rating-epic/15 border border-rating-epic/30">
                    <Waves className="h-6 w-6 text-rating-epic" />
                  </div>
                  <div className="text-right leading-none">
                    <div className="text-3xl font-black text-rating-epic">∞</div>
                    <div className="text-[10px] uppercase tracking-wider text-foreground/40">memórias</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-base mb-1.5">Diário de surf</h3>
                  <p className="text-sm text-foreground/60 leading-relaxed">Registre suas sessões, notas e memórias no seu diário de surf pessoal.</p>
                </div>
                <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-rating-epic/10 blur-2xl pointer-events-none" />
              </div>
            </Reveal>
          </div>

          <Reveal className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild
              className="font-bold px-8 h-12 text-sm bg-primary hover:bg-primary/90"
              style={{ boxShadow: '0 0 32px oklch(0.6 0.16 200 / 0.4)' }}>
              <Link to="/login">
                Criar conta grátis
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild
              className="font-bold px-8 h-12 text-sm"
              style={{ borderColor: 'oklch(0.65 0.18 50 / 0.4)', color: 'oklch(0.7 0.15 50)' }}>
              <Link to="/login?plan=premium">
                <Crown className="h-4 w-4 mr-2" />
                Ver Premium
              </Link>
            </Button>
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
              <p className="text-foreground/70 leading-relaxed">
                O Surf AI funciona igual a um app de verdade, sem ocupar espaço da loja. Acesse pelo Safari ou Chrome e adicione à tela inicial em segundos.
              </p>
              <Button asChild className="font-bold bg-primary hover:bg-primary/90"
                style={{ boxShadow: '0 0 20px oklch(0.6 0.16 200 / 0.3)' }}>
                <Link to="/login">
                  Acessar agora
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </Reveal>

            <div className="flex flex-col gap-4">
              {[
                { step: '1', title: 'Abra no seu navegador', desc: 'Digite surfaifloripa.com.br no Safari (iPhone) ou Chrome (Android)', icon: Waves },
                { step: '2', title: 'Toque em "Adicionar à Tela de Início"', desc: 'iPhone: toque no ícone de compartilhar ⬆️ na barra debaixo do Safari, role e toque em "Adicionar à Tela de Início". Android: toque nos 3 pontinhos ⋮ no canto superior do Chrome e toque em "Adicionar à tela inicial"', icon: Smartphone },
                { step: '3', title: 'Pronto, é isso!', desc: 'O ícone aparece na tela inicial e abre em tela cheia, sem barra de endereço', icon: CheckCircle2 },
              ].map(({ step, title, desc, icon: Icon }, i) => (
                <Reveal key={step} delay={i * 0.12}>
                  <div className="flex items-center gap-4 rounded-xl p-4 transition-transform duration-200 hover:scale-[1.01]"
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

      {/* PREÇO — mensal e anual juntos, um bloco só (antes existiam 2 desconectados) */}
      <section id="pricing" className="py-20 relative border-t border-border/30">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 50% 40% at 50% 50%, oklch(0.55 0.18 60 / 0.04), transparent)' }} />
        <div className="container mx-auto px-5 max-w-4xl relative">
          <Reveal className="text-center mb-12">
            <Badge className="bg-rating-fair/15 text-rating-fair border-rating-fair/30 mb-4">
              <Crown className="h-3 w-3 mr-1.5" />Premium
            </Badge>
            <h2 className="text-3xl md:text-4xl font-black mb-3">
              Leve seu surf ao<br />
              <span className="text-rating-fair">próximo nível.</span>
            </h2>
            <p className="text-foreground/70 leading-relaxed max-w-md mx-auto">
              Menos que o combustível de uma ida até a praia errada, e você nunca mais chega quando o mar está ruim.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-10 items-center mb-10">
            <Reveal className="space-y-2.5">
              {[
                { icon: BarChart3, title: 'Previsão 14 dias completa' },
                { icon: Bell, title: 'Alertas quando seu spot estiver épico' },
                { icon: TrendingUp, title: 'Histórico completo de condições' },
                { icon: Shield, title: 'Experiência 100% sem anúncios' },
                { icon: Zap, title: 'Acesso antecipado a novos recursos' },
              ].map(({ icon: Icon, title }) => (
                <div key={title} className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-lg bg-rating-fair/15 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-3.5 w-3.5 text-rating-fair" />
                  </div>
                  <span className="text-sm font-medium">{title}</span>
                </div>
              ))}
            </Reveal>

            {/* Dois planos lado a lado — mensal e anual, sem duplicar a mesma info em outro lugar da página */}
            <div className="grid grid-cols-2 gap-3">
              <Reveal delay={0.1}>
                <div className="h-full rounded-2xl p-5 flex flex-col items-center text-center gap-1"
                  style={{ background: 'oklch(1 0 0 / 0.03)', border: '1px solid oklch(1 0 0 / 0.1)' }}>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Mensal</div>
                  <div className="text-3xl font-black text-foreground leading-none">R$16<span className="text-lg">,90</span></div>
                  <div className="text-xs text-muted-foreground mb-3">por mês</div>
                  <Button asChild variant="outline" size="sm" className="w-full font-semibold">
                    <Link to="/login?plan=premium">Assinar</Link>
                  </Button>
                </div>
              </Reveal>
              <Reveal delay={0.2}>
                <div className="h-full rounded-2xl p-5 flex flex-col items-center text-center gap-1 relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, oklch(0.7 0.18 60 / 0.15), oklch(0.6 0.22 50 / 0.1))',
                    border: '1px solid oklch(0.65 0.18 50 / 0.4)',
                    boxShadow: '0 0 24px oklch(0.6 0.18 60 / 0.2)',
                  }}>
                  <Badge className="absolute -top-0.5 right-2 bg-rating-fair text-[9px] px-1.5 py-0 h-4 text-background">-26%</Badge>
                  <div className="text-xs text-rating-fair uppercase tracking-widest mb-1 font-semibold">Anual</div>
                  <div className="text-3xl font-black text-rating-fair leading-none">R$12<span className="text-lg">,49</span></div>
                  <div className="text-xs text-muted-foreground mb-3">por mês · R$149,90/ano</div>
                  <Button asChild size="sm"
                    className="w-full font-semibold"
                    style={{ background: 'linear-gradient(135deg, oklch(0.7 0.18 60), oklch(0.6 0.22 50))', color: 'oklch(0.1 0.02 240)' }}>
                    <Link to="/login?plan=premium">Assinar</Link>
                  </Button>
                </div>
              </Reveal>
            </div>
          </div>

          <Reveal className="flex flex-wrap items-center justify-center gap-6">
            {['Pagamento seguro', 'Sem fidelidade', 'Cancele quando quiser'].map(t => (
              <span key={t} className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-rating-good" />{t}
              </span>
            ))}
          </Reveal>
        </div>
      </section>

      {/* FAQ — objeções resolvidas logo depois do preço, antes do fechamento final */}
      <section className="py-20 border-t border-border/30">
        <div className="container mx-auto px-5 max-w-2xl">
          <Reveal className="text-center mb-14">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-4 px-4 py-1">FAQ</Badge>
            <h2 className="text-3xl md:text-4xl font-black mb-4">Ainda com dúvida?<br />A gente responde.</h2>
            <p className="text-foreground/70">Perguntas que todo surfista faz antes de baixar.</p>
          </Reveal>
          <div className="space-y-3">
            {FAQS.map(faq => <FAQItem key={faq.q} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      {/* CTA FINAL — agora é o último bloco de conteúdo de verdade, logo antes do footer */}
      <section className="py-20 border-t border-border/30 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[120px] opacity-20"
            style={{ background: 'radial-gradient(ellipse, oklch(0.6 0.2 210), transparent 70%)' }} />
        </div>
        <div className="container mx-auto px-5 max-w-2xl text-center relative">
          <Reveal>
            <div className="rounded-3xl p-10 md:p-14 relative overflow-hidden"
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
                  <AppLogo size={56} variant="icon" />
                </div>
                <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6 text-xs font-semibold"
                  style={{ background: 'oklch(0.6 0.2 210 / 0.12)', border: '1px solid oklch(0.6 0.2 210 / 0.3)', color: 'oklch(0.75 0.15 200)' }}>
                  <div className="h-1.5 w-1.5 rounded-full bg-rating-good animate-pulse" />
                  {BEACH_COUNT} praias monitoradas agora
                </div>
                <h2 className="text-3xl md:text-5xl font-black mb-4 leading-tight">
                  Sua próxima sessão épica<br />
                  <span className="text-transparent bg-clip-text"
                    style={{
                      backgroundImage: 'linear-gradient(135deg, oklch(0.75 0.16 200), oklch(0.5 0.2 220))',
                    }}>
                    começa aqui.
                  </span>
                </h2>
                <p className="text-muted-foreground mb-8 leading-relaxed text-base max-w-md mx-auto">
                  Dados reais de {BEACH_COUNT} praias, nota de IA e alertas personalizados.
                  Crie sua conta grátis em menos de 1 minuto.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
                  <Button size="lg" asChild
                    className="font-bold px-10 h-12 text-base relative overflow-hidden group"
                    style={{
                      background: 'oklch(0.6 0.2 210)',
                      boxShadow: '0 0 40px oklch(0.6 0.2 210 / 0.6), 0 0 80px oklch(0.6 0.2 210 / 0.2), inset 0 1px 0 oklch(1 0 0 / 0.15)',
                    }}>
                    <Link to="/login">
                      Criar conta gratuita
                      <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild
                    className="font-bold px-8 h-12"
                    style={{ borderColor: 'oklch(0.65 0.18 50 / 0.4)', color: 'oklch(0.7 0.15 50)' }}>
                    <Link to="/login?plan=premium">
                      <Crown className="h-4 w-4 mr-2" />
                      Ver plano Premium
                    </Link>
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-6">
                  {['Grátis para começar', 'Sem cartão de crédito', 'Funciona no iPhone e Android'].map(t => (
                    <span key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-rating-good flex-shrink-0" />{t}
                    </span>
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
            Florianópolis, SC · Dados atualizados a cada 15 minutos · Feito com 🤙 para surfistas
          </div>
          <div className="flex items-center gap-3">
            <Link to="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Privacidade
            </Link>
            <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Entrar
            </Link>
            <Button size="sm" variant="outline" asChild
              className="text-xs border-primary/30 hover:bg-primary/5 hover:border-primary/50">
              <Link to="/login">Começar grátis</Link>
            </Button>
          </div>
        </div>
      </footer>

      {/* CTA FLUTUANTE */}
      <FloatingCTA onFree={() => navigate('/login')} onPremium={() => navigate('/login?plan=premium')} />

    </div>
  )
}
