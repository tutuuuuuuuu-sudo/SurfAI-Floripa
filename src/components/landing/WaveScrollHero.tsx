import { useEffect, useRef, useState, type ReactNode } from 'react'
import waveVideo from '@/assets/landing/wave-break.mp4'
import wavePoster from '@/assets/landing/wave-break-poster.jpg'

// Vídeo real (Pexels, licença livre para uso comercial, crédito: Ravi Kant) — uma onda se
// aproximando e quebrando de frente pra câmera. O scroll do usuário controla o currentTime
// do vídeo (scrubbing), não é reproduzido sozinho. Ao "quebrar", revela o resto da landing.
export function WaveScrollHero({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [textOpacity, setTextOpacity] = useState(1)
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
    const video = videoRef.current
    const container = containerRef.current
    if (!video || !container) return

    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const rect = container.getBoundingClientRect()
        const scrollable = rect.height - window.innerHeight
        const progress = scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 0
        if (video.duration) video.currentTime = progress * video.duration
        setTextOpacity(Math.max(0, 1 - progress / 0.35))
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [reducedMotion])

  return (
    <div ref={containerRef} className="relative" style={{ height: reducedMotion ? undefined : '220vh' }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {reducedMotion ? (
          <img src={wavePoster} alt="Onda quebrando em Florianópolis" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            src={waveVideo}
            poster={wavePoster}
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, oklch(0.1 0.02 240 / 0.55) 0%, oklch(0.1 0.02 240 / 0.15) 45%, oklch(0.08 0.02 240) 100%)' }} />

        <div className="relative z-10 flex h-full flex-col items-center justify-center px-5 text-center"
          style={{ opacity: textOpacity, transition: reducedMotion ? undefined : 'opacity 0.05s linear' }}>
          {children}
        </div>

        {!reducedMotion && (
          <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/70"
            style={{ opacity: textOpacity }}>
            <span className="text-xs font-medium">Role pra ver a onda quebrar</span>
            <div className="h-8 w-5 rounded-full border border-white/40 flex justify-center pt-1.5">
              <div className="h-1.5 w-1 rounded-full bg-white/70 animate-bounce" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
