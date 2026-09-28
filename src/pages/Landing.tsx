import { Link } from 'react-router-dom'
import { ArrowRight, Crown } from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'
import { FAQItem, Reveal } from '@/components/landing/LandingComponents'
import { Hero } from '@/components/landing/Hero'
import { LiveBulletin } from '@/components/landing/LiveBulletin'
import { IslandMap } from '@/components/landing/IslandMap'
import { DayCurveDemo } from '@/components/landing/DayCurveDemo'
import { ChatDemo } from '@/components/landing/ChatDemo'
import { PlanCompare } from '@/components/landing/PlanCompare'
import { FAQS } from '@/components/landing/landingData'
import { BEACH_DIRECTORY } from '@/lib/beachDirectory'

// Landing v2 (28/set/2026). Em vez de blocos genéricos anunciando recursos, a página usa as
// peças vivas do próprio app com o dado real do momento — por isso nunca fica desatualizada
// (a versão anterior mostrava prints velhos, com a região "Leste" que já não existia).
// Ordem segue o tempo: AGORA (boletim + ilha) → AMANHÃ (curva) → PERGUNTE (chat) → planos,
// dúvidas e fechamento. Saíram: vitrine de prints, "3 jeitos", fotos por região, números
// ("24/7", "3 regiões"), "Como funciona", "Mais recursos", seção de instalação (virou
// pergunta do FAQ), bolhas de cor desfocadas no fundo e o botão flutuante (o menu do topo já
// fica preso na tela com "Começar grátis"; o flutuante só duplicava e cobria conteúdo).

const BEACH_COUNT = BEACH_DIRECTORY.length

function SectionHead({ kicker, title, children }: { kicker?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <Reveal className="flex flex-col gap-3">
      {kicker && <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{kicker}</p>}
      <h2 className="text-3xl font-black leading-tight text-balance md:text-4xl">{title}</h2>
      {children && <p className="max-w-lg text-foreground/70">{children}</p>}
    </Reveal>
  )
}

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground">

      {/* MENU — preso no topo, com o único botão de conta que acompanha a rolagem */}
      <nav className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-md"
        style={{ background: 'color-mix(in oklch, var(--background) 90%, transparent)' }}>
        <div className="container mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <AppLogo size={34} variant="full" />
          <div className="flex items-center gap-1">
            <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/85 hover:text-foreground">
              Entrar
            </Link>
            <Link to="/login" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90">
              Começar grátis
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* AGORA — boletim do mar deste momento */}
      <Hero>
        <LiveBulletin />
      </Hero>

      {/* AGORA — a ilha inteira, praia por praia */}
      <section id="ilha" className="relative z-10 py-14">
        <div className="container mx-auto flex max-w-3xl flex-col gap-6 px-5">
          <SectionHead kicker={`${BEACH_COUNT} praias · ao vivo`} title="A ilha inteira, agora.">
            Cada ponto é uma praia, na cor da nota deste momento. Toca numa praia pra ver a onda, o vento e a maré.
          </SectionHead>
          <IslandMap />
        </div>
      </section>

      {/* AMANHÃ — a curva do dia real do app */}
      <section id="amanha" className="relative z-10 border-t border-border/40 py-14">
        <div className="container mx-auto flex max-w-2xl flex-col gap-6 px-5">
          <SectionHead kicker="Previsão" title="Amanhã, hora a hora.">
            Arrasta o dedo pela curva. Essa é a previsão real de amanhã, do jeito que aparece no app:
            a nota de cada hora, a onda, a maré e o vento.
          </SectionHead>
          <DayCurveDemo />
        </div>
      </section>

      {/* PERGUNTE — conversa de exemplo no tom do chat real */}
      <section id="chat" className="relative z-10 border-t border-border/40 py-14">
        <div className="container mx-auto flex max-w-2xl flex-col gap-6 px-5">
          <SectionHead kicker={<><Crown className="h-3.5 w-3.5" />Premium</>} title="Pergunta pro Surf AI.">
            Em vez de ler tabela, pergunta do seu jeito. Ele responde com o mar de agora e a previsão da semana.
          </SectionHead>
          <ChatDemo />
        </div>
      </section>

      {/* PLANOS — grátis x premium lado a lado */}
      <section id="pricing" className="relative z-10 border-t border-border/40 py-14">
        <div className="container mx-auto flex max-w-2xl flex-col gap-6 px-5">
          <SectionHead title="Comece grátis. Assine se fizer falta.">
            O plano grátis já mostra a nota das {BEACH_COUNT} praias e a previsão dos próximos dias. O Premium libera o resto.
          </SectionHead>
          <PlanCompare />
        </div>
      </section>

      {/* DÚVIDAS */}
      <section id="faq" className="relative z-10 border-t border-border/40 py-14">
        <div className="container mx-auto flex max-w-2xl flex-col gap-4 px-5">
          <SectionHead title="Perguntas frequentes" />
          <div className="border-t border-border/60">
            {FAQS.map(faq => <FAQItem key={faq.q} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      {/* FECHAMENTO */}
      <section className="relative z-10 border-t border-border/40 py-16">
        <div className="container mx-auto flex max-w-2xl flex-col items-start gap-5 px-5">
          <h2 className="text-3xl font-black leading-tight md:text-4xl">O mar muda toda hora.</h2>
          <p className="max-w-lg text-foreground/70">
            Cria sua conta grátis e acompanha as {BEACH_COUNT} praias da ilha, com a previsão dos próximos dias.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/login" className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-base font-bold text-primary-foreground hover:bg-primary/90">
              Criar conta grátis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#pricing" className="text-sm font-semibold text-primary hover:underline">Ver os planos</a>
          </div>
        </div>
      </section>

      {/* RODAPÉ */}
      <footer className="border-t border-border/40 py-8">
        <div className="container mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-5 md:flex-row">
          <AppLogo size={30} variant="full" />
          <p className="text-xs text-muted-foreground">Florianópolis, SC</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground">Privacidade</Link>
            <Link to="/terms" className="hover:text-foreground">Termos de Uso</Link>
            <Link to="/login" className="hover:text-foreground">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
