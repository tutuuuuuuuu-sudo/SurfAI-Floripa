import { useEffect, useRef, useState } from 'react'
import { Waves, CalendarDays, GitCompareArrows, BellRing } from 'lucide-react'
import scoreImg from '@/assets/landing/app-screens/score.png'
import forecastImg from '@/assets/landing/app-screens/forecast.png'
import compareImg from '@/assets/landing/app-screens/compare.png'
import alertsImg from '@/assets/landing/app-screens/alerts.png'

const STEPS = [
  {
    image: scoreImg,
    icon: Waves,
    title: 'Score de IA em tempo real',
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
    desc: 'Não sabe pra onde ir? Compare score, ondas e vento de até 3 praias ao mesmo tempo.',
  },
  {
    image: alertsImg,
    icon: BellRing,
    title: 'Alertas na hora certa',
    desc: 'Defina o score mínimo que você aceita e receba um aviso assim que sua praia favorita ficar boa.',
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
    <div className="grid grid-cols-[minmax(96px,34vw)_1fr] gap-4 sm:grid-cols-[160px_1fr] sm:gap-8 md:grid-cols-[280px_1fr] md:gap-16">
      <div>
        <div className="sticky top-20 z-10 md:top-24">
          <PhoneFrame active={active} />
        </div>
      </div>

      <div className="flex flex-col">
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            ref={(el) => { refs.current[i] = el }}
            className="flex min-h-[45vh] flex-col justify-center gap-3 py-8 md:min-h-[55vh]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-300"
              style={{
                background: active === i ? 'oklch(0.6 0.16 200 / 0.15)' : 'oklch(1 0 0 / 0.04)',
                border: `1px solid ${active === i ? 'oklch(0.6 0.16 200 / 0.4)' : 'oklch(1 0 0 / 0.08)'}`,
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
  )
}

function PhoneFrame({ active }: { active: number }) {
  return (
    <div className="relative mx-auto aspect-[390/844] w-full max-w-[240px] rounded-[28px] border-[4px] p-1 sm:rounded-[36px] sm:border-[5px] md:max-w-[280px] md:rounded-[44px] md:border-[6px] md:p-1.5"
      style={{
        borderColor: '#2c2c2c',
        background: '#0d0d0d',
        boxShadow: '0 24px 60px oklch(0 0 0 / 0.45), 0 0 0 1px oklch(1 0 0 / 0.06), 0 0 80px oklch(0.6 0.16 200 / 0.08)',
      }}>
      <div className="absolute left-1/2 top-1.5 z-20 h-3 w-10 -translate-x-1/2 rounded-full bg-black sm:top-2 sm:h-4 sm:w-14 md:top-2.5 md:h-5 md:w-20" />
      <div className="relative h-full w-full overflow-hidden rounded-[22px] bg-muted sm:rounded-[30px] md:rounded-[36px]">
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
