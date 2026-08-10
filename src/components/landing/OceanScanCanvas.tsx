import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import './oceanScanShader'
import waveHero from '@/assets/landing/wave-hero.jpg'

function ScanPlane() {
  const materialRef = useRef<THREE.ShaderMaterial & {
    uScanProgress: number
    uResolution: THREE.Vector2
    uPointer: THREE.Vector2
    uPhotoScale: THREE.Vector2
    uPhotoOffset: THREE.Vector2
  }>(null)
  const texture = useTexture(waveHero)
  const { viewport, size } = useThree()
  const pointer = useRef(new THREE.Vector2(0, 0))

  const coverFit = useMemo(() => {
    const image = texture.image as { width: number; height: number }
    const imageAspect = image.width / image.height
    const containerAspect = size.width / size.height
    if (containerAspect > imageAspect) {
      return { scale: new THREE.Vector2(1, imageAspect / containerAspect), offset: new THREE.Vector2(0, (1 - imageAspect / containerAspect) / 2) }
    }
    return { scale: new THREE.Vector2(containerAspect / imageAspect, 1), offset: new THREE.Vector2((1 - containerAspect / imageAspect) / 2, 0) }
  }, [texture, size.width, size.height])

  useFrame((state) => {
    const material = materialRef.current
    if (!material) return
    material.uScanProgress = Math.sin(state.clock.elapsedTime * 0.35) * 0.5 + 0.5
    material.uResolution.set(size.width, size.height)
    pointer.current.lerp(state.pointer, 0.05)
    material.uPointer.copy(pointer.current)
    material.uPhotoScale.copy(coverFit.scale)
    material.uPhotoOffset.copy(coverFit.offset)
  })

  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      {/* @ts-expect-error oceanScanMaterial é registrado via extend() em oceanScanShader.ts */}
      <oceanScanMaterial ref={materialRef} uPhoto={texture} uHasDepth={0} />
    </mesh>
  )
}

export default function OceanScanCanvas({ onContextLost }: { onContextLost?: () => void }) {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 1], zoom: 100 }}
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: false }}
      onCreated={({ gl }) => {
        // Perda de contexto WebGL acontece de verdade no Safari/iOS sob pressão de
        // memória — sem isso o canvas fica congelado em branco em vez de cair pra foto estática.
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          onContextLost?.()
        })
      }}
    >
      <ScanPlane />
    </Canvas>
  )
}
