import { useEffect, useRef, useState } from 'react'
import { Waves, CalendarDays, GitCompareArrows, Navigation } from 'lucide-react'
import scoreImg from '@/assets/landing/app-screens/score.png'
import forecastImg from '@/assets/landing/app-screens/forecast.png'
import compareImg from '@/assets/landing/app-screens/compare.png'
import navigateImg from '@/assets/landing/app-screens/navigate.png'

const STEPS = [
  {
    image: scoreImg,
    icon: Waves,
    title: 'Nota de IA em tempo real',
    desc: 'Ondas, vento, maré e período viram uma nota de 0 a 10, atualizada a cada 15 minutos.',
  },
  {
    image: forecastImg,
    icon: CalendarDays,
    title: 'Previsão de 14 dias',
    desc: 'Planeje a semana inteira e descubra com antecedência qual vai ser o melhor dia pra surfar.',
  },
  {
    image: compareImg,
    icon: GitCompareArrows,
    title: 'Compare picos lado a lado',
    desc: 'Não sabe pra onde ir? Compare a nota, ondas e vento de até 3 praias ao mesmo tempo.',
  },
  {
    image: navigateImg,
    icon: Navigation,
    title: 'Me leva ao pico',
    desc: 'Um toque e o app já abre o caminho: Google Maps ou Waze, direto pro pico com a melhor condição agora.',
  },
]

// Screenshots reais do app rodando (capturados em ago/2026) — nunca trocar por UI recriada à mão.
export function AppScrollShowcase() {
  const [active, setActive] = useState(0)
  const refs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = refs.current.findIndex((el) => el === entry.target)
            if (index !== -1) setActive(index)
          }
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )
    refs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <>
      {/* MOBILE — empilhado: cada passo tem sua própria imagem grande, sem sticky/sync
          (o celular ficava espremido a ~130px de largura dividindo coluna com o texto,
          pequeno demais pra ler numa tela de verdade). */}
      <div className="flex flex-col gap-14 sm:hidden">
        {STEPS.map((step) => (
          <div key={step.title} className="flex flex-col items-center gap-5 text-center">
            <div className="relative mx-auto w-full max-w-[280px] rounded-[36px] border-[5px] p-1.5"
              style={{
                borderColor: '#2c2c2c',
                background: '#0d0d0d',
                boxShadow: '0 24px 60px oklch(0 0 0 / 0.45), 0 0 0 1px oklch(1 0 0 / 0.06), 0 0 60px oklch(0.6 0.16 200 / 0.1)',
              }}>
              <div className="absolute left-1/2 top-2 z-20 h-4 w-14 -translate-x-1/2 rounded-full bg-black" />
              {/* aspect-ratio aqui (não na moldura externa) pra bater exatamente com os
                  prints 390×844 — antes a proporção ficava na moldura, que soma borda+padding,
                  então a área interna real tinha uma proporção levemente diferente da imagem
                  e o crop manual (top/height) desalinhava o conteúdo dentro do celular.
                  Raio interno = raio externo (36px) menos borda+padding (11px) — raio maior
                  que isso faz o canto interno "estourar" pra fora do canto externo na
                  diagonal (achado 24/ago/2026, visível nos 4 cantos do celular). */}
              <div className="relative aspect-[390/844] w-full overflow-hidden rounded-[25px]" style={{ background: '#0d0d0d' }}>
                <img src={step.image} alt={step.title} className="absolute inset-0 h-full w-full object-cover" />
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{
                background: 'oklch(0.6 0.16 200 / 0.15)',
                border: '1px solid oklch(0.6 0.16 200 / 0.4)',
                boxShadow: '0 0 20px oklch(0.6 0.16 200 / 0.3)',
              }}>
              <step.icon className="h-5 w-5" style={{ color: 'oklch(0.6 0.16 200)' }} />
            </div>
            <h3 className="text-xl font-black">{step.title}</h3>
            <p className="max-w-xs text-sm text-foreground/70">{step.desc}</p>
          </div>
        ))}
      </div>

      {/* DESKTOP/TABLET — celular fixo com scroll-sync */}
      <div className="hidden sm:grid sm:grid-cols-[160px_1fr] sm:gap-8 md:grid-cols-[280px_1fr] md:gap-16">
        <div>
          <div className="sticky top-20 z-10 md:top-24">
            <PhoneFrame active={active} />
          </div>
        </div>

        <div className="relative flex flex-col pl-6">
          <div className="absolute left-0 top-0 h-full w-px bg-white/8" />
          <div className="absolute left-0 w-px transition-all duration-500 ease-out"
            style={{
              top: `${(active / STEPS.length) * 100}%`,
              height: `${(1 / STEPS.length) * 100}%`,
              background: 'oklch(0.6 0.16 200)',
              boxShadow: '0 0 12px oklch(0.6 0.16 200 / 0.6)',
            }} />
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              ref={(el) => { refs.current[i] = el }}
              className="relative flex min-h-[45vh] flex-col justify-center gap-3 rounded-2xl py-8 pl-5 pr-4 transition-all duration-300 md:min-h-[55vh]"
              style={{
                background: active === i ? 'oklch(0.6 0.16 200 / 0.06)' : 'transparent',
                transform: active === i ? 'translateX(4px)' : 'translateX(0)',
              }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300"
                style={{
                  background: active === i ? 'oklch(0.6 0.16 200 / 0.15)' : 'oklch(1 0 0 / 0.04)',
                  border: `1px solid ${active === i ? 'oklch(0.6 0.16 200 / 0.4)' : 'oklch(1 0 0 / 0.08)'}`,
                  boxShadow: active === i ? '0 0 20px oklch(0.6 0.16 200 / 0.35)' : 'none',
                  transform: active === i ? 'scale(1.08)' : 'scale(1)',
                }}>
                <step.icon className="h-4.5 w-4.5 transition-colors duration-300" style={{ color: active === i ? 'oklch(0.6 0.16 200)' : 'oklch(0.7 0.02 240)' }} />
              </div>
              <h3 className="text-lg font-black transition-opacity duration-300 sm:text-xl md:text-2xl" style={{ opacity: active === i ? 1 : 0.35 }}>
                {step.title}
              </h3>
              <p className="max-w-sm text-sm text-foreground/70 transition-opacity duration-300" style={{ opacity: active === i ? 1 : 0.3 }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function PhoneFrame({ active }: { active: number }) {
  return (
    <div className="relative mx-auto w-full max-w-[240px] rounded-[28px] border-[4px] p-1 sm:rounded-[36px] sm:border-[5px] md:max-w-[280px] md:rounded-[44px] md:border-[6px] md:p-1.5"
      style={{
        borderColor: '#2c2c2c',
        background: '#0d0d0d',
        boxShadow: '0 24px 60px oklch(0 0 0 / 0.45), 0 0 0 1px oklch(1 0 0 / 0.06), 0 0 80px oklch(0.6 0.16 200 / 0.08)',
      }}>
      <div className="absolute left-1/2 top-1.5 z-20 h-3 w-10 -translate-x-1/2 rounded-full bg-black sm:top-2 sm:h-4 sm:w-14 md:top-2.5 md:h-5 md:w-20" />
      {/* Raio interno = raio externo menos borda+padding em cada breakpoint (28-8=20,
          36-11=25, 44-12=32) — mesmo ajuste do card mobile empilhado acima. */}
      <div className="relative aspect-[390/844] w-full overflow-hidden rounded-[20px] sm:rounded-[25px] md:rounded-[32px]" style={{ background: '#0d0d0d' }}>
        {STEPS.map((step, i) => (
          <img
            key={step.title}
            src={step.image}
            alt={step.title}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
            style={{ opacity: active === i ? 1 : 0 }}
          />
        ))}
      </div>
    </div>
  )
}
