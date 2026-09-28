import { useEffect, useRef, useState } from 'react'
import { Waves, Clock, Compass, Navigation } from 'lucide-react'
import scoreImg from '@/assets/landing/app-screens/score.webp'
import forecastImg from '@/assets/landing/app-screens/forecast.webp'
import windImg from '@/assets/landing/app-screens/wind.webp'
import navigateImg from '@/assets/landing/app-screens/navigate.webp'

const STEPS = [
  {
    image: scoreImg,
    icon: Waves,
    title: 'A nota de cada praia, agora',
    desc: 'Onda, período e vento de cada praia viram uma nota de 0 a 10, atualizada ao longo do dia. Você bate o olho e sabe se vale sair de casa.',
  },
  {
    image: forecastImg,
    icon: Clock,
    title: 'O dia inteiro, hora a hora',
    desc: 'Arraste pela curva e veja a nota de cada hora, com onda, vento e maré. No Premium, até 14 dias pra frente.',
  },
  {
    image: windImg,
    icon: Compass,
    title: 'Vento e maré sem mistério',
    desc: 'A rosa dos ventos mostra de onde o vento vem e com que força. A maré mostra quando enche e quando seca.',
  },
  {
    image: navigateImg,
    icon: Navigation,
    title: 'Da tela direto pro pico',
    desc: 'Escolha a praia e o app abre o caminho no Google Maps ou no Waze, inclusive nas que têm acesso por trilha.',
  },
]

// Screenshots reais do app rodando (recapturados em 28/set/2026, 780x1688 = 2x de um celular de
// 390px, WebP) — nunca trocar por UI recriada à mão. Os de ago/2026 mostravam a região "Leste",
// que não existe mais; quando uma tela mudar de verdade no app, tirar o print de novo.
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
          <div key={step.title} className="flex flex-col items-center gap-4 text-center">
            {/* Título e texto EM CIMA do print (antes vinham embaixo, e quem rolava lia o
                título colado no print seguinte — achado na auditoria de 25/set/2026) */}
            <div className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{
                background: 'color-mix(in oklch, var(--primary) 15%, transparent)',
                border: '1px solid color-mix(in oklch, var(--primary) 40%, transparent)',
                boxShadow: '0 0 20px color-mix(in oklch, var(--primary) 30%, transparent)',
              }}>
              <step.icon className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            <h3 className="text-xl font-black">{step.title}</h3>
            <p className="max-w-xs text-sm text-foreground/70">{step.desc}</p>
            <div className="relative mx-auto mt-2 w-full max-w-[280px] rounded-[36px] border-[5px] p-1.5"
              style={{
                borderColor: '#2c2c2c',
                background: '#0d0d0d',
                boxShadow: '0 24px 60px oklch(0 0 0 / 0.45), 0 0 0 1px color-mix(in oklch, var(--foreground) 6%, transparent), 0 0 60px color-mix(in oklch, var(--primary) 10%, transparent)',
              }}>
              {/* aspect-ratio aqui (não na moldura externa) pra bater exatamente com os prints
                  (proporção 390×844). Raio interno = raio externo (36px) menos borda+padding
                  (11px) — maior que isso o canto interno "estoura" pra fora (24/ago/2026). */}
              <div className="relative aspect-[390/844] w-full overflow-hidden rounded-[25px]" style={{ background: '#0d0d0d' }}>
                <img src={step.image} alt={step.title} width={390} height={844} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
              </div>
            </div>
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
          <div className="absolute left-0 top-0 h-full w-px" style={{ background: 'color-mix(in oklch, var(--foreground) 8%, transparent)' }} />
          <div className="absolute left-0 w-px transition-all duration-500 ease-out"
            style={{
              top: `${(active / STEPS.length) * 100}%`,
              height: `${(1 / STEPS.length) * 100}%`,
              background: 'var(--primary)',
              boxShadow: '0 0 12px color-mix(in oklch, var(--primary) 60%, transparent)',
            }} />
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              ref={(el) => { refs.current[i] = el }}
              className="relative flex min-h-[45vh] flex-col justify-center gap-3 rounded-2xl py-8 pl-5 pr-4 transition-all duration-300 md:min-h-[55vh]"
              style={{
                background: active === i ? 'color-mix(in oklch, var(--primary) 6%, transparent)' : 'transparent',
                transform: active === i ? 'translateX(4px)' : 'translateX(0)',
              }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300"
                style={{
                  background: active === i ? 'color-mix(in oklch, var(--primary) 15%, transparent)' : 'color-mix(in oklch, var(--foreground) 4%, transparent)',
                  border: `1px solid ${active === i ? 'color-mix(in oklch, var(--primary) 40%, transparent)' : 'color-mix(in oklch, var(--foreground) 8%, transparent)'}`,
                  boxShadow: active === i ? '0 0 20px color-mix(in oklch, var(--primary) 35%, transparent)' : 'none',
                  transform: active === i ? 'scale(1.08)' : 'scale(1)',
                }}>
                <step.icon className="h-4.5 w-4.5 transition-colors duration-300" style={{ color: active === i ? 'var(--primary)' : 'var(--muted-foreground)' }} />
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
        boxShadow: '0 24px 60px oklch(0 0 0 / 0.45), 0 0 0 1px color-mix(in oklch, var(--foreground) 6%, transparent), 0 0 80px color-mix(in oklch, var(--primary) 8%, transparent)',
      }}>
      {/* Raio interno = raio externo menos borda+padding em cada breakpoint (28-8=20,
          36-11=25, 44-12=32) — mesmo ajuste do card mobile empilhado acima. */}
      <div className="relative aspect-[390/844] w-full overflow-hidden rounded-[20px] sm:rounded-[25px] md:rounded-[32px]" style={{ background: '#0d0d0d' }}>
        {STEPS.map((step, i) => (
          <img
            key={step.title}
            src={step.image}
            alt={step.title}
            width={390}
            height={844}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
            style={{ opacity: active === i ? 1 : 0 }}
          />
        ))}
      </div>
    </div>
  )
}
