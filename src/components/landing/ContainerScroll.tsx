import { useRef, type ReactNode } from 'react'
import { useScroll, useTransform, motion, type MotionValue } from 'framer-motion'
import { useIsMobile } from '@/hooks/use-mobile'
import { useReducedMotion } from '@/hooks/use-reduced-motion'

export function ContainerScroll({ titleComponent, children }: { titleComponent: ReactNode; children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef })
  const isMobile = useIsMobile()
  const reducedMotion = useReducedMotion()

  const scaleRange: [number, number] = isMobile ? [0.85, 0.95] : [1.03, 1]
  const rotateAnim = useTransform(scrollYProgress, [0, 1], [16, 0])
  const scaleAnim = useTransform(scrollYProgress, [0, 1], scaleRange)
  const translateAnim = useTransform(scrollYProgress, [0, 1], [0, -60])

  const rotate = reducedMotion ? 0 : rotateAnim
  const scale = reducedMotion ? 1 : scaleAnim
  const translate = reducedMotion ? 0 : translateAnim

  return (
    <div className="min-h-[34rem] md:min-h-[42rem] flex items-center justify-center relative p-2 md:p-12" ref={containerRef}>
      <div className="py-6 md:py-16 w-full relative" style={{ perspective: '1200px' }}>
        <Header translate={translate} titleComponent={titleComponent} />
        <Card rotate={rotate} translate={translate} scale={scale}>{children}</Card>
      </div>
    </div>
  )
}

function Header({ translate, titleComponent }: { translate: MotionValue<number> | number; titleComponent: ReactNode }) {
  return (
    <motion.div style={{ translateY: translate }} className="max-w-3xl mx-auto text-center">
      {titleComponent}
    </motion.div>
  )
}

function Card({ rotate, scale, children }: {
  rotate: MotionValue<number> | number
  scale: MotionValue<number> | number
  translate: MotionValue<number> | number
  children: ReactNode
}) {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        boxShadow: '0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003',
      }}
      // Frame de celular (não laptop) — nosso produto é um screenshot de app mobile em
      // retrato, então o "hardware" mostrado precisa ser um telefone.
      // Cores literais intencionais: moldura de hardware, não superfície temática (ver regra em src/index.css).
      className="relative mx-auto -mt-6 aspect-[430/745] w-full max-w-[300px] md:max-w-[340px] rounded-[44px] border-[6px] border-[#2c2c2c] bg-[#0d0d0d] p-1.5 shadow-2xl"
    >
      <div className="absolute left-1/2 top-2.5 z-20 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
      <div className="h-full w-full overflow-hidden rounded-[36px] bg-muted">
        {children}
      </div>
    </motion.div>
  )
}
