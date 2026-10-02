import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Bell, BarChart3, Clock, Shield, ArrowRight, CheckCircle2, TrendingUp,
  Crown, Sparkles, Compass, Waves, Mail, Instagram,
} from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'
import { FAQItem, Reveal } from '@/components/landing/LandingComponents'
import { PremiumMorning } from '@/components/landing/PremiumMorning'
import todayImg from '@/assets/landing/app-screens/today.webp'
import { PhoneMock } from '@/components/landing/PhoneMock'
import { Hero } from '@/components/landing/Hero'
import { DayCurveDemo } from '@/components/landing/DayCurveDemo'
import { ChatDemo } from '@/components/landing/ChatDemo'
import { FAQS } from '@/components/landing/landingData'
import { BEACH_DIRECTORY } from '@/lib/beachDirectory'
import { countLandingCta, countLandingView } from '@/lib/landingStats'
import { PRICE_MONTHLY, PRICE_ANNUAL, PRICE_ANNUAL_PER_MONTH, TRIAL_DAYS, formatBRL } from '@/lib/pricing'

// Desconto do anual sobre o mensal, pro selo do card (-26%)
const ANNUAL_DISCOUNT_PCT = Math.round((1 - PRICE_ANNUAL_PER_MONTH / PRICE_MONTHLY) * 100)

// Landing "juntada" (28/set/2026): a estrutura e o visual da landing anterior (foto da ilha,
// vitrine com prints do app, cartões de preço, animações de entrada) com as peças vivas da v2
// que o usuário aprovou — mapa da ilha com as praias acesas (+ fotos das regiões), curva de
// amanhã pra arrastar e o chat de exemplo. A v2 inteira ("só dado") foi rejeitada por ser fria
// e sem emoção (ver memória feedback_landing_needs_emotion). Saíram da antiga: números fracos
// ("24/7", "3 regiões"), "Como funciona" 01/02/03, "Mais recursos", seção de instalação (virou
// pergunta do FAQ), exemplos falsos (janela em barras, chat velho) e o botão flutuante que
// cobria conteúdo (o menu do topo já fica preso na tela com "Começar grátis").
// Argumento central da copy, nas palavras do usuário: nenhuma outra plataforma mostra TODAS
// as praias de Floripa com uma nota de 0 a 10, incluindo os picos de cada praia.
// Ajustes de 29/set/2026 (pedido do usuário): título volta a "O surf de Floripa na palma da
// mão" com destaque forte, sem o selo ao vivo no topo; ondas animadas na passagem da foto pra
// página; sai a vitrine de celular com rolagem; ilha sem fotos, explicada como mapa em tempo
// real; um único print do app ("A nota de cada praia, agora") fora da moldura de celular;
// perguntas novas no chat; "E ainda tem mais" virou uma manhã com o Premium; título do preço.
// Plano D (29/set/2026): as ondas desenhadas da passagem saíram. Rolando, a câmera sobe da foto
// da Praia Mole até a ilha inteira e pousa no mapa com a lista de praias (Hero.tsx) — o mapa da
// ilha é o fim do próprio topo, não uma seção separada.

const BEACH_COUNT = BEACH_DIRECTORY.length
function SectionHead({ badge, title, children, center = true }: { badge: React.ReactNode; title: React.ReactNode; children?: React.ReactNode; center?: boolean }) {
  return (
    <Reveal className={center ? 'text-center mb-10' : 'mb-8'}>
      {badge}
      <h2 className="text-3xl md:text-4xl font-black mb-4 text-balance">{title}</h2>
      {children && <p className={`text-foreground/70 max-w-xl ${center ? 'mx-auto' : ''}`}>{children}</p>}
    </Reveal>
  )
}

const pill = 'border-primary/30 text-primary bg-primary/5 mb-4 px-4 py-1'

export default function Landing() {
  // Contador anônimo (sem cookie): quantas visitas e quantos cliques em cada botão, por dia
  useEffect(() => { countLandingView() }, [])

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
        style={{ background: 'color-mix(in oklch, var(--background) 88%, transparent)', borderColor: 'color-mix(in oklch, var(--foreground) 6%, transparent)' }}>
        <div className="container mx-auto px-5 py-3 flex items-center justify-between max-w-6xl">
          <div className="flex items-center gap-2.5">
            <AppLogo size={34} variant="full" />
            <Badge variant="outline" className="hidden sm:flex border-primary/30 text-primary bg-primary/5 text-[10px] px-2 py-0.5">
              Florianópolis
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-sm text-foreground/85 hover:text-foreground">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button size="sm" asChild className="text-sm font-bold px-4 bg-primary hover:bg-primary/90"
              style={{ boxShadow: '0 0 16px color-mix(in oklch, var(--primary) 25%, transparent)' }}>
              <Link to="/login" onClick={() => countLandingCta('nav')}>
                Começar grátis
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* HERO — foto da Praia Mole + promessa; rolando, a câmera sobe até o mapa da ilha (Hero.tsx) */}
      <Hero>
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 sm:gap-5 [@media(max-height:700px)]:gap-3">
          <h1 className="text-[2.7rem] [@media(max-height:700px)]:text-[2.2rem] md:text-7xl font-black leading-[1.02] tracking-tight text-white overflow-hidden text-balance"
            style={{ textShadow: '0 4px 32px oklch(0 0 0 / 0.45)' }}>
            <span className="block" style={{ animation: 'textReveal 0.7s ease 0.1s both' }}>
              O surf de <span className="text-sea-gradient" style={{ textShadow: 'none', filter: 'drop-shadow(0 4px 18px oklch(0.6 0.18 210 / 0.55))' }}>Floripa</span>
            </span>
            <span className="block" style={{ animation: 'textReveal 0.7s ease 0.25s both' }}>
              na palma da mão.
            </span>
          </h1>

          <p className="text-lg [@media(max-height:700px)]:text-base text-white/90 max-w-lg leading-relaxed"
            style={{ animation: 'fadeIn 0.7s ease 0.4s both', textShadow: '0 2px 10px oklch(0 0 0 / 0.85), 0 1px 3px oklch(0 0 0 / 0.9)' }}>
            O Surf AI acompanha as {BEACH_COUNT} praias de Floripa, pico por pico, e dá uma nota de 0 a 10
            pro mar de agora e dos próximos 14 dias.
          </p>

          <div className="flex w-full flex-col sm:w-auto sm:flex-row gap-3" style={{ animation: 'slideUp 0.6s ease 0.5s both' }}>
            <Button size="lg" asChild
              className="text-base font-bold px-8 h-12 relative overflow-hidden group bg-primary hover:bg-primary/90"
              style={{ boxShadow: '0 0 40px color-mix(in oklch, var(--primary) 45%, transparent)' }}>
              <Link to="/login" onClick={() => countLandingCta('hero')}>
                <span className="relative z-10 flex items-center gap-2">
                  Criar conta grátis
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild
              className="text-base font-bold px-8 h-12 text-white border-white/40 hover:bg-black/50 hover:text-white"
              style={{ background: 'oklch(0.14 0.02 230 / 0.55)', backdropFilter: 'blur(12px)' }}>
              <a href="#pricing" onClick={() => countLandingCta('hero-planos')}>
                <Crown className="h-4 w-4 mr-2 text-rating-fair" />
                Ver planos
              </a>
            </Button>
          </div>
        </div>
      </Hero>

      {/* AMANHÃ — curva real pra arrastar */}
      <section id="amanha" className="py-20 border-t border-border/30 relative z-10">
        <div className="container mx-auto px-5 max-w-2xl">
          <SectionHead badge={<Badge variant="outline" className={pill}><Clock className="h-3 w-3 mr-1.5" />Previsão de amanhã</Badge>}
            title="Escolha a hora certa de cair.">
            Chegue no pico antes do vento entrar. A previsão de amanhã, hora a hora, em cada praia.
          </SectionHead>
          <DayCurveDemo />
        </div>
      </section>

      {/* A NOTA DE CADA PRAIA — um print real do app, fora da moldura de celular */}
      <section className="py-20 border-t border-border/30 relative z-10 overflow-hidden">
        <div className="container mx-auto grid max-w-5xl items-center gap-12 px-5 md:grid-cols-2">
          <Reveal>
            <Badge variant="outline" className={pill}><Waves className="h-3 w-3 mr-1.5" />Dentro do app</Badge>
            <h2 className="text-3xl md:text-4xl font-black mb-4 text-balance">A nota de cada praia, agora.</h2>
            <p className="text-foreground/70">
              Cada praia ganha uma nota de 0 a 10, hora a hora. Você vê quando o mar fica bom e quando piora, antes de sair de casa.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <PhoneMock>
              <div className="relative aspect-[390/720] w-full">
                <img src={todayImg} alt="Tela do Surf AI com a nota de hoje do Campeche, hora a hora" width={390} height={844} loading="lazy" decoding="async"
                  className="absolute inset-0 h-full w-full object-cover object-top" />
              </div>
            </PhoneMock>
          </Reveal>
        </div>
      </section>

      {/* CHAT — conversa de exemplo com dado real */}
      <section id="chat" className="py-20 border-t border-border/30 relative z-10">
        <div className="container mx-auto px-5 max-w-2xl">
          <SectionHead badge={<Badge className="bg-rating-fair/15 text-rating-fair border-rating-fair/30 mb-4 px-4 py-1"><Crown className="h-3 w-3 mr-1.5" />Premium</Badge>}
            title="Pergunte ao Surf AI.">
            Pergunte do jeito que você perguntaria no grupo do surf. O Surf AI conhece o mar de agora,
            cada pico da ilha e a previsão da semana, e responde na hora.
          </SectionHead>
          <ChatDemo />
        </div>
      </section>

      {/* MAIS NO PREMIUM — uma manhã de surf com ele */}
      <section className="py-20 border-t border-border/30 relative z-10">
        <div className="container mx-auto px-5 max-w-5xl">
          <SectionHead badge={<Badge className="bg-rating-fair/15 text-rating-fair border-rating-fair/30 mb-4 px-4 py-1"><Crown className="h-3 w-3 mr-1.5" />Premium</Badge>}
            title="Enquanto você dorme, o Surf AI fica de olho no mar.">
            Veja como é uma manhã com o Premium: o aviso chega, você escolhe a praia e cai na hora certa.
          </SectionHead>
          <PremiumMorning />
        </div>
      </section>

      {/* PREÇO */}
      <section id="pricing" className="py-20 relative border-t border-border/30">
        <div className="container mx-auto px-5 max-w-4xl relative">
          <SectionHead badge={<Badge className="bg-rating-fair/15 text-rating-fair border-rating-fair/30 mb-4"><Crown className="h-3 w-3 mr-1.5" />Premium</Badge>}
            title={<>Custa menos que uma ida<br /><span className="text-rating-fair">até a praia errada.</span></>}>
            O Premium libera os 14 dias de previsão, o chat com o Surf AI, os alertas e tudo o que você viu nesta página.
            Pague com Pix, cartão ou boleto, sem fidelidade.
          </SectionHead>

          <div className="grid md:grid-cols-2 gap-10 items-center mb-10">
            <Reveal className="space-y-2.5">
              {[
                { icon: Sparkles, title: 'Chat com o Surf AI' },
                { icon: BarChart3, title: 'Previsão de 14 dias, hora a hora' },
                { icon: Clock, title: 'Melhor janela do dia' },
                { icon: Compass, title: 'Bora Surfar, a praia boa mais perto de você' },
                { icon: Bell, title: 'Alertas na nota que você escolher, praia por praia' },
                { icon: TrendingUp, title: 'Histórico de 30 dias e comparação de praias' },
                { icon: Shield, title: 'Sem anúncios' },
              ].map(({ icon: Icon, title }) => (
                <div key={title} className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-lg bg-rating-fair/15 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-3.5 w-3.5 text-rating-fair" />
                  </div>
                  <span className="text-sm font-medium">{title}</span>
                </div>
              ))}
            </Reveal>

            <div className="grid grid-cols-2 gap-3">
              <Reveal delay={0.1}>
                <div className="h-full rounded-2xl p-5 flex flex-col items-center text-center gap-1"
                  style={{ background: 'color-mix(in oklch, var(--foreground) 3%, transparent)', border: '1px solid color-mix(in oklch, var(--foreground) 10%, transparent)' }}>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Mensal</div>
                  <div className="text-3xl font-black text-foreground leading-none">R${Math.floor(PRICE_MONTHLY)}<span className="text-lg">,{formatBRL(PRICE_MONTHLY).split(',')[1]}</span></div>
                  <div className="text-xs text-muted-foreground mb-3">por 30 dias</div>
                  <Button asChild variant="outline" size="sm" className="w-full font-semibold">
                    <Link to="/login?plan=premium" onClick={() => countLandingCta('preco-mensal')}>Assinar</Link>
                  </Button>
                </div>
              </Reveal>
              <Reveal delay={0.2}>
                <div className="h-full rounded-2xl p-5 flex flex-col items-center text-center gap-1 relative overflow-hidden"
                  style={{
                    background: 'color-mix(in oklch, var(--rating-fair) 13%, transparent)',
                    border: '1px solid color-mix(in oklch, var(--rating-fair) 40%, transparent)',
                    boxShadow: '0 0 24px color-mix(in oklch, var(--rating-fair) 20%, transparent)',
                  }}>
                  <Badge className="absolute -top-0.5 right-2 bg-rating-fair text-[9px] px-1.5 py-0 h-4 text-background">-{ANNUAL_DISCOUNT_PCT}%</Badge>
                  <div className="text-xs text-rating-fair uppercase tracking-widest mb-1 font-semibold">Anual</div>
                  <div className="text-3xl font-black text-rating-fair leading-none">R${Math.floor(PRICE_ANNUAL_PER_MONTH)}<span className="text-lg">,{formatBRL(PRICE_ANNUAL_PER_MONTH).split(',')[1]}</span></div>
                  <div className="text-xs text-muted-foreground mb-3">por mês · {formatBRL(PRICE_ANNUAL).replace(' ', '')}/ano</div>
                  <Button asChild size="sm" className="w-full font-semibold"
                    style={{ background: 'var(--rating-fair)', color: 'oklch(0.1 0.02 240)' }}>
                    <Link to="/login?plan=premium" onClick={() => countLandingCta('preco-anual')}>Assinar</Link>
                  </Button>
                </div>
              </Reveal>
            </div>
          </div>

          <Reveal className="flex flex-col items-center gap-5">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {['Pix, cartão ou boleto', 'Sem fidelidade', 'Reembolso em até 7 dias'].map(t => (
                <span key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-rating-good" />{t}
                </span>
              ))}
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Quer conhecer antes? Teste o Premium inteiro por {TRIAL_DAYS} dias, sem cartão e sem cobrança no fim.{' '}
              <Link to="/login?plan=premium" onClick={() => countLandingCta('teste-gratis')} className="font-semibold text-primary hover:underline">Testar {TRIAL_DAYS} dias grátis</Link>
            </p>
            <p className="text-xs text-muted-foreground text-center">
              O plano grátis continua mostrando a nota das {BEACH_COUNT} praias e 3 dias de previsão.{' '}
              <Link to="/login" onClick={() => countLandingCta('preco-gratis')} className="font-semibold text-primary hover:underline">Criar conta grátis</Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 border-t border-border/30">
        <div className="container mx-auto px-5 max-w-2xl">
          <SectionHead badge={<Badge variant="outline" className={pill}>Dúvidas</Badge>}
            title="Perguntas frequentes" />
          <div className="space-y-3">
            {FAQS.map(faq => <FAQItem key={faq.q} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      {/* FECHAMENTO */}
      <section className="py-20 border-t border-border/30 relative overflow-hidden">
        <div className="container mx-auto px-5 max-w-2xl text-center relative">
          <Reveal>
            <div className="rounded-3xl p-10 md:p-14 relative overflow-hidden"
              style={{
                background: 'color-mix(in oklch, var(--foreground) 2.5%, transparent)',
                border: '1px solid color-mix(in oklch, var(--primary) 25%, transparent)',
                boxShadow: '0 8px 64px oklch(0 0 0 / 0.4), 0 0 120px color-mix(in oklch, var(--primary) 12%, transparent)',
              }}>
              <div className="flex justify-center mb-6">
                <AppLogo size={56} variant="icon" />
              </div>
              <h2 className="text-3xl md:text-5xl font-black mb-4 leading-tight text-balance">
                O próximo dia bom<br />
                <span className="text-primary">já está na previsão.</span>
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed text-base max-w-md mx-auto">
                Crie sua conta grátis e veja agora como estão as {BEACH_COUNT} praias de Floripa.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" asChild className="font-bold px-10 h-12 text-base group bg-primary hover:bg-primary/90"
                  style={{ boxShadow: '0 0 40px color-mix(in oklch, var(--primary) 50%, transparent)' }}>
                  <Link to="/login" onClick={() => countLandingCta('fechamento')}>
                    Criar conta grátis
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="font-bold px-8 h-12"
                  style={{ borderColor: 'color-mix(in oklch, var(--rating-fair) 40%, transparent)', color: 'var(--rating-fair)' }}>
                  <a href="#pricing" onClick={() => countLandingCta('fechamento-planos')}>
                    <Crown className="h-4 w-4 mr-2" />
                    Ver planos
                  </a>
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* RODAPÉ */}
      <footer className="py-8"
        style={{ borderTop: '1px solid color-mix(in oklch, var(--foreground) 6%, transparent)' }}>
        <div className="container mx-auto px-5 max-w-5xl flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <AppLogo size={30} variant="full" />
            <div className="text-xs text-muted-foreground text-center md:text-left">
              Florianópolis, SC · Feito em Floripa, pra quem surfa em Floripa
            </div>
          </div>
          <div className="flex flex-col items-center gap-3 md:items-end">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <a href="https://www.instagram.com/surfaifloripa/" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-foreground/80 hover:text-foreground transition-colors">
                <Instagram className="h-4 w-4" />@surfaifloripa
              </a>
              <a href="mailto:surfaifloripa@gmail.com"
                className="inline-flex items-center gap-1.5 text-sm text-foreground/80 hover:text-foreground transition-colors">
                <Mail className="h-4 w-4" />surfaifloripa@gmail.com
              </a>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacidade</Link>
              <Link to="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Termos de Uso</Link>
              <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Entrar</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
