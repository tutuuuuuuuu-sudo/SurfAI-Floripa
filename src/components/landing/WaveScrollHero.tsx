import { useEffect, useRef, useState, type ReactNode } from 'react'
import waveVideo from '@/assets/landing/wave-break.mp4'
import wavePoster from '@/assets/landing/wave-break-poster.jpg'
import aerialBg from '@/assets/landing/aerial-floripa.jpg'

const START_W_VW = 56
const START_H_VH = 16
const START_BOTTOM_VH = 4
const START_RADIUS_PX = 28

// Duas camadas, geradas com Gemini (Nano Banana Pro + Veo 3.1): uma foto aérea da ilha em
// tela cheia atrás (foge conforme rola) e um vídeo de onda quebrando tocando em loop normal
// dentro da caixinha que cresce — nada de scrubbing de currentTime (isso travava o scroll,
// buscar frame a frame num mp4 comprimido é caro). O scroll só controla o TAMANHO da caixa:
// começa pequena e arredondada (lembra o anel de score do app) e se abre até virar tela
// cheia — a onda "explode" no momento em que o resto da landing é revelado.
export function WaveScrollHero({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
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
    const container = containerRef.current
    if (!container) return

    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const rect = container.getBoundingClientRect()
        const scrollable = rect.height - window.innerHeight
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

  const textOpacity = Math.max(0, 1 - progress / 0.45)
  const boxWidth = `${START_W_VW + progress * (100 - START_W_VW)}vw`
  const boxHeight = `${START_H_VH + progress * (100 - START_H_VH)}vh`
  const boxBottom = `${START_BOTTOM_VH * (1 - progress)}vh`
  const boxRadius = `${START_RADIUS_PX * (1 - progress)}px`

  return (
    <div ref={containerRef} className="relative" style={{ height: reducedMotion ? undefined : '200vh' }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden"
        style={{ background: 'oklch(0.08 0.02 240)' }}>

        {reducedMotion ? (
          <img src={wavePoster} alt="Onda quebrando em Florianópolis" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
            <div className="absolute inset-0" style={{ opacity: 1 - progress }}>
              <img src={aerialBg} alt="Vista aérea da ilha de Florianópolis" className="h-full w-full object-cover" />
              <div className="absolute inset-0"
                style={{ background: 'linear-gradient(180deg, oklch(0.08 0.02 240 / 0.8) 0%, oklch(0.08 0.02 240 / 0.4) 55%, oklch(0.08 0.02 240 / 0.75) 100%)' }} />
            </div>
            <div className="absolute left-1/2 z-0"
              style={{
                width: boxWidth,
                height: boxHeight,
                bottom: boxBottom,
                transform: 'translateX(-50%)',
                borderRadius: boxRadius,
                overflow: 'hidden',
                boxShadow: progress < 0.95 ? '0 30px 80px oklch(0 0 0 / 0.5), 0 0 0 1px oklch(1 0 0 / 0.08)' : 'none',
                transition: 'box-shadow 0.3s ease',
              }}>
              <video
                src={waveVideo}
                poster={wavePoster}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(180deg, oklch(0.1 0.02 240 / 0.5) 0%, transparent 40%, oklch(0.08 0.02 240 / 0.65) 100%)' }} />
            </div>
          </>
        )}

        <div className="absolute inset-x-0 top-0 z-10 flex flex-col items-center px-5 pt-10 text-center sm:pt-14"
          style={{ opacity: reducedMotion ? 1 : textOpacity, transition: reducedMotion ? undefined : 'opacity 0.05s linear' }}>
          {children}
        </div>

        {!reducedMotion && (
          <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/70"
            style={{ opacity: textOpacity }}>
            <span className="text-xs font-medium">Role pra ver a onda se abrir</span>
            <div className="h-8 w-5 rounded-full border border-white/40 flex justify-center pt-1.5">
              <div className="h-1.5 w-1 rounded-full bg-white/70 animate-bounce" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
