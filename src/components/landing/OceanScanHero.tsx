import { lazy, Suspense, useState } from 'react'
import { useWebglSupport } from '@/hooks/use-webgl-support'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import waveHero from '@/assets/landing/wave-hero.jpg'

const OceanScanCanvas = lazy(() => import('./OceanScanCanvas'))

export function OceanScanHero({ className = '' }: { className?: string }) {
  const webglSupported = useWebglSupport()
  const reducedMotion = useReducedMotion()
  const [contextLost, setContextLost] = useState(false)

  const staticImage = (
    <img
      src={waveHero}
      alt="Mar de Florianópolis"
      loading="eager"
      decoding="async"
      className="h-full w-full object-cover"
    />
  )

  return (
    <div className={className}>
      {!webglSupported || reducedMotion || contextLost ? staticImage : (
        <Suspense fallback={staticImage}>
          <OceanScanCanvas onContextLost={() => setContextLost(true)} />
        </Suspense>
      )}
    </div>
  )
}
