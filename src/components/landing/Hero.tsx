import { useEffect, useRef, useState, type ReactNode } from 'react'
import aerialBg from '@/assets/landing/aerial-floripa.jpg'

// Referência pedida pelo usuário (27/set/2026, prints/vídeo mandados no WhatsApp):
// um recorte em forma de onda separa a foto do conteúdo abaixo (em vez de um corte
// reto), e a foto "some" de fato enquanto rola, conectando com o que vem depois —
// não só um degradê fixo. Por isso o hero fica `sticky` durante uma faixa curta de
// rolagem extra: a foto (com a onda) desbota e some enquanto a próxima seção já
// está subindo por baixo, então as duas se cruzam visualmente. Nada de vídeo, nada
// de caixinha crescendo (isso foi removido antes por parecer "gerado por IA").
const TRANSITION_VH = 46 // faixa extra de rolagem (respiro pra foto desbotar antes de sumir)

export function Hero({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mql.matches)
    const onChange = () => setReducedMotion(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (reducedMotion) return
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const rect = outer.getBoundingClientRect()
        const heroPx = inner.clientHeight
        const scrollable = rect.height - heroPx
        const next = scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 0
        setProgress(next)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [reducedMotion])

  const fade = reducedMotion ? 1 : Math.max(0, 1 - progress * 1.15)

  return (
    <div ref={outerRef} className="relative w-full" style={{ height: reducedMotion ? undefined : `calc(clamp(520px, 78vh, 760px) + ${TRANSITION_VH}vh)` }}>
      <div ref={innerRef} className="sticky top-0 w-full overflow-hidden" style={{ height: 'clamp(520px, 78vh, 760px)', background: 'var(--background)' }}>
        <div className="absolute inset-0" style={{ opacity: fade, transform: `scale(${1 + (1 - fade) * 0.04})`, transformOrigin: 'center' }}>
          <img
            src={aerialBg}
            alt="Vista aérea da ilha de Florianópolis"
            width={1000}
            height={1791}
            fetchPriority="high"
            className="h-full w-full object-cover"
            style={{ animation: reducedMotion ? undefined : 'heroZoom 26s ease-in-out infinite alternate' }}
          />
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, rgba(6,12,16,.6) 0%, rgba(6,12,16,.3) 42%, rgba(6,12,16,.18) 78%, transparent 100%)' }} />
          {/* faixa curta acima da onda pra textura da foto ir se misturando na cor de fundo antes do recorte */}
          <div className="absolute inset-x-0 bottom-0 h-24"
            style={{ background: 'linear-gradient(180deg, transparent, var(--background))' }} />
          {/* recorte em onda — mesma ideia da referência (foto "rasgada" por uma onda, não um corte reto) */}
          <svg className="absolute inset-x-0 bottom-0 w-full" viewBox="0 0 1440 160" preserveAspectRatio="none"
            style={{ height: '11vh', minHeight: 64, maxHeight: 120 }} aria-hidden="true">
            <path d="M0,64 C 220,120 380,10 620,58 C 860,106 1040,14 1440,70 L1440,160 L0,160 Z" fill="var(--background)" />
          </svg>
        </div>

        <div className="relative z-10 flex h-full flex-col items-center justify-center px-5 pb-16 pt-6 text-center"
          style={{ opacity: fade }}>
          {children}
        </div>
      </div>
    </div>
  )
}
