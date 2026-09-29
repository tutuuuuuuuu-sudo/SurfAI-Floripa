import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import photoMole from '@/assets/landing/flyover/photo-mole.webp'
import orthoXfine from '@/assets/landing/flyover/ortho-xfine.webp'
import orthoFine from '@/assets/landing/flyover/ortho-fine.webp'
import orthoMid from '@/assets/landing/flyover/ortho-mid.webp'
import orthoCoarse from '@/assets/landing/flyover/ortho-coarse.webp'
import s2Detail from '@/assets/landing/flyover/s2-detail.webp'
import baseTall from '@/assets/landing/flyover/base-tall.webp'
import baseWide from '@/assets/landing/flyover/base-wide.webp'
import { getRatingInfo } from '@/lib/rating'
import { ISLAND_PATH, ISLAND_VIEWBOX } from '@/components/landing/islandShape'
import { useIslandBeaches } from '@/components/landing/useIslandBeaches'
import { IslandBeachList, IslandSummary } from '@/components/landing/IslandBeachList'

// Topo da landing: "a câmera sobe" (29/set/2026, ideia do usuário). Começa numa foto de verdade da
// Praia Mole vista de cima e, rolando, a câmera se afasta sem corte: a foto dá lugar à aerofoto do
// Estado (mesmo lugar, mesma escala), depois ao satélite, até a ilha inteira pousar no mapa ao
// lado da lista de praias. Tocar numa praia (na lista ou no ponto) marca ela no mapa.
//
// Por que não trava (a 1ª versão travava no celular): a animação é montada uma vez (Web
// Animations, só transform/opacity) e o próprio navegador a toca junto com a rolagem
// (ViewTimeline) — sem código rodando a cada quadro. Navegador sem esse recurso: o mesmo desenho,
// só que o avanço é ajustado pela rolagem em JS. As bordas esfumadas estão dentro das imagens
// (nada de máscara no CSS) e cada camada é uma <img> sozinha, que o celular amplia na placa de
// vídeo sem redesenhar.
//
// Camadas (unidades do desenho da ilha, islandShape.ts, ~91 m cada; geradas por
// .content-drafts/flyover/build.py, fora do git):
// - foto: Tiago Muraro (Unsplash License), Praia Mole, encaixada na aerofoto (giro de 11°)
// - aerofoto: Governo de SC, SIGSC OrtoRGB 2012 (WMS público, sem taxa/restrição), cor convertida
//   pra do satélite; 4 níveis (0,4 km na resolução máxima de 0,39 m, 0,7 / 2,2 / 6,5 km)
// - satélite: Copernicus Sentinel-2 (ESA), 21/ago/2026; detalhe perto da Mole + base da ilha

const NAV = 60 // menu fixo da landing, por cima do palco
const PIN_SVH = 130 // quanto se rola com o palco preso, em % da altura visível da tela
const ZOOM_END = 0.82 // a câmera termina de subir aqui; depois entram mapa e lista
const BOX = { x: -14, y: -8, w: ISLAND_VIEWBOX.width + 28, h: ISLAND_VIEWBOX.height + 16 }

type Layer = { src: string; x: number; y: number; w: number; h: number; px: number; feather: number; fadeSmall?: boolean }
const BASE: Record<'tall' | 'wide', Layer> = {
  tall: { src: baseTall, x: -120, y: -358, w: 820, h: 1234, px: 1066, feather: 0.03 },
  wide: { src: baseWide, x: -440, y: -358, w: 1240, h: 1234, px: 1612, feather: 0.03 },
}
// De baixo pra cima, cada vez mais perto da Mole. Somem quando ficam pequenas na tela (a aerofoto
// é de 2012 e não pode aparecer como remendo no mapa final, que é só satélite)
const DETAILS: Layer[] = [
  { src: s2Detail, x: 92.55, y: 149.05, w: 140, h: 270, px: 700, feather: 0.14, fadeSmall: true },
  { src: orthoCoarse, x: 126.55, y: 233.05, w: 72, h: 72, px: 880, feather: 0.16, fadeSmall: true },
  { src: orthoMid, x: 150.55, y: 257.05, w: 24, h: 24, px: 960, feather: 0.16, fadeSmall: true },
  { src: orthoFine, x: 158.55, y: 265.05, w: 8, h: 8, px: 900, feather: 0.16, fadeSmall: true },
  { src: orthoXfine, x: 160.25, y: 266.75, w: 4.6, h: 4.6, px: 1076, feather: 0.2, fadeSmall: true },
]
// A foto (2000x1333), que é também o ponto em volta do qual a câmera sobe. De verdade ela cobre
// ~1,3 unidade; aqui fica um pouco maior (2,2) pra diminuir o salto de nitidez pra aerofoto
const PHOTO = { src: photoMole, cx: 162.55, cy: 269.05, w: 2.2, h: 2.2 / 1.5, rot: -11, feather: 0.17 }
const PHOTO_LAYER: Layer = { src: photoMole, x: PHOTO.cx - PHOTO.w / 2, y: PHOTO.cy - PHOTO.h / 2, w: PHOTO.w, h: PHOTO.h, px: 2000, feather: PHOTO.feather }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a))
const smooth = (t: number) => t * t * (3 - 2 * t)
// Sai do lugar num ritmo firme (passa rápido pela fase em que a foto ainda é bem maior que a
// aerofoto em volta) e pousa devagar no mapa
const cameraEase = (t: number) => 0.65 * Math.sin((Math.PI * t) / 2) + 0.35 * (-(Math.cos(Math.PI * t) - 1) / 2)

type Layout = { W: number; H: number; k: number; ox: number; oy: number; wide: boolean; s0: number }

// Câmera no progresso p: escala s (1 = mapa final), giro e onde o centro da foto cai na tela
function camera(L: Layout, p: number) {
  const z = cameraEase(seg(p, 0, ZOOM_END))
  const s = Math.exp(Math.log(L.s0) * (1 - z)) // sobe em progressão geométrica, como uma câmera
  const w = (L.s0 / s - 1) / (L.s0 - 1) // o centro fica na Mole até quase o fim e só então vai pro mapa
  const x = L.W / 2 + (L.ox + PHOTO.cx * L.k - L.W / 2) * w
  const y = L.H / 2 + (L.oy + PHOTO.cy * L.k - L.H / 2) * w
  const theta = -PHOTO.rot * (1 - smooth(seg(z, 0.12, 0.65))) // começa com a foto reta, termina com o norte pra cima
  return { s, x, y, theta }
}

// Base de cada <img>: a caixa no CSS já tem ~ o tamanho da imagem, e a animação só escala
const baseScale = (l: Layer, k: number) => Math.max(1, l.px / (2 * l.w * k))

function layerFrames(L: Layout, layers: { l: Layer; photo?: boolean }[], samples = 64) {
  const frames = layers.map(() => [] as Keyframe[])
  const view = Math.max(L.W, L.H)
  for (let i = 0; i <= samples; i++) {
    const p = i / samples
    const c = camera(L, p)
    // de cima pra baixo: uma camada opaca que já cobre a tela inteira esconde as de baixo
    let covered = false
    for (let j = layers.length - 1; j >= 0; j--) {
      const { l, photo } = layers[j]
      const f = l.feather * Math.min(l.w, l.h)
      let op = 1
      if (photo) op = smooth(seg(l.w * L.k * c.s, 0.35 * L.W, 1.1 * L.W))
      else if (l.fadeSmall) op = smooth(seg(l.w * L.k * c.s, 90, 190))
      if (covered) op = 0
      if (op >= 1 && Math.min(l.w - 2 * f, l.h - 2 * f) * L.k * c.s >= view * (photo ? 1.02 : 1.3)) covered = true
      const b = photo ? L.s0 : baseScale(l, L.k)
      const inner = photo
        ? `rotate(${PHOTO.rot}deg) translate(${(-l.w * L.k * b) / 2}px, ${(-l.h * L.k * b) / 2}px)`
        : `rotate(0deg) translate(${L.k * b * (l.x - PHOTO.cx)}px, ${L.k * b * (l.y - PHOTO.cy)}px)`
      frames[j].push({
        offset: p,
        opacity: op,
        transform: `translate(${c.x}px, ${c.y}px) rotate(${c.theta}deg) scale(${c.s / b}) ${inner}`,
      })
    }
  }
  return frames
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

export function Hero({ children }: { children: ReactNode }) {
  const reduced = usePrefersReducedMotion()
  if (reduced) {
    // Sem movimento: foto parada e, logo abaixo, a ilha já montada
    return (
      <>
        <div className="relative z-10 flex w-full items-center justify-center overflow-hidden px-5 pb-16 pt-10 text-center" style={{ minHeight: 'clamp(560px, 82svh, 800px)' }}>
          <img src={PHOTO.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="hero-scrim absolute inset-0" />
          <div className="relative z-10">{children}</div>
        </div>
        <IslandStage />
      </>
    )
  }
  return <IslandStage hero={children} />
}

type ViewTimelineCtor = new (opts: { subject: Element; axis?: string }) => AnimationTimeline

// hero presente = palco com rolagem (foto → ilha); sem hero = ilha já montada, parada
function IslandStage({ hero }: { hero?: ReactNode }) {
  const animated = hero !== undefined
  const { beaches, summary } = useIslandBeaches()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const pick = (id: string) => setSelectedId(prev => (prev === id ? null : id))

  const trackRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLElement>(null)
  const probeRef = useRef<HTMLDivElement>(null) // mede a altura visível garantida (100svh)
  const slotRef = useRef<HTMLDivElement>(null) // onde a ilha pousa no fim
  const baseRef = useRef<HTMLImageElement>(null)
  const detailRefs = useRef<(HTMLImageElement | null)[]>([])
  const photoRef = useRef<HTMLImageElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const vignetteRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const cueRef = useRef<HTMLDivElement>(null)
  const dimRef = useRef<SVGSVGElement>(null)
  const finalRef = useRef<HTMLDivElement>(null)

  const [layout, setLayout] = useState<Layout | null>(null)
  const animsRef = useRef<Animation[]>([])
  const scrollDrivenRef = useRef(false) // true = o navegador toca sozinho (ViewTimeline)
  const pinRef = useRef(0)

  // Mede onde a ilha pousa (o espaço do mapa ao lado da lista) e o tamanho da tela
  useLayoutEffect(() => {
    const stage = stageRef.current, slot = slotRef.current, probe = probeRef.current
    if (!stage || !slot || !probe) return
    const measure = () => {
      let x = 0, y = 0
      let el: HTMLElement | null = slot
      while (el && el !== stage) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent as HTMLElement | null }
      const W = stage.clientWidth, H = probe.clientHeight
      const k = slot.clientWidth / BOX.w
      const f = PHOTO.feather * Math.min(PHOTO.w, PHOTO.h)
      const s0 = Math.max(W / ((PHOTO.w - 2 * f) * k), H / ((PHOTO.h - 2 * f) * k)) * 1.04
      const next: Layout = { W, H, k, ox: x - BOX.x * k, oy: y - BOX.y * k, wide: W / H >= 1, s0 }
      setLayout(prev => (prev && (Object.keys(next) as (keyof Layout)[]).every(key =>
        typeof next[key] === 'number' ? Math.abs((prev[key] as number) - (next[key] as number)) < 0.5 : prev[key] === next[key]) ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(stage)
    ro.observe(slot)
    return () => ro.disconnect()
  }, [])

  // Monta a animação inteira pra este tamanho de tela
  useLayoutEffect(() => {
    if (!layout) return
    const L = layout
    const pin = (PIN_SVH / 100) * L.H
    pinRef.current = pin
    if (railRef.current) railRef.current.style.height = `${pin + window.innerHeight}px`

    const list: [Element | null, Keyframe[]][] = []
    const world: { el: HTMLImageElement | null; l: Layer; photo?: boolean }[] = [
      { el: baseRef.current, l: L.wide ? BASE.wide : BASE.tall },
      ...(animated ? DETAILS.map((l, i) => ({ el: detailRefs.current[i], l })) : []),
      ...(animated ? [{ el: photoRef.current, l: PHOTO_LAYER, photo: true }] : []),
    ]
    layerFrames(L, world).forEach((frames, i) => list.push([world[i].el, frames]))
    if (animated) {
      list.push([scrimRef.current, [{ offset: 0, opacity: 1 }, { offset: 0.12, opacity: 0 }, { offset: 1, opacity: 0 }]])
      // borda escura de lente no começo: esconde a aerofoto ampliada demais em volta da foto
      list.push([vignetteRef.current, [{ offset: 0, opacity: 1 }, { offset: 0.06, opacity: 1 }, { offset: 0.3, opacity: 0 }, { offset: 1, opacity: 0 }]])
      list.push([heroRef.current, [
        { offset: 0, opacity: 1, transform: 'translateY(0px)' },
        { offset: 0.1, opacity: 0, transform: 'translateY(-48px)' },
        { offset: 1, opacity: 0, transform: 'translateY(-48px)' },
      ]])
      list.push([cueRef.current, [{ offset: 0, opacity: 1 }, { offset: 0.04, opacity: 0 }, { offset: 1, opacity: 0 }]])
    }
    list.push([dimRef.current, [{ offset: 0, opacity: 0 }, { offset: 0.7, opacity: 0 }, { offset: 0.88, opacity: 1 }, { offset: 1, opacity: 1 }]])
    list.push([finalRef.current, [
      { offset: 0, opacity: 0, transform: 'translateY(16px)' },
      { offset: 0.74, opacity: 0, transform: 'translateY(16px)' },
      { offset: 0.9, opacity: 1, transform: 'translateY(0px)' },
      { offset: 1, opacity: 1, transform: 'translateY(0px)' },
    ]])

    const paused = () => list.flatMap(([el, frames]) => {
      if (!el) return []
      const a = el.animate(frames, { duration: 1000, fill: 'both' })
      a.pause()
      return [a]
    })

    // O navegador toca a animação junto com a rolagem, quando sabe (Chrome, Safari 26+)
    const VT = (window as unknown as { ViewTimeline?: ViewTimelineCtor }).ViewTimeline
    let anims: Animation[] = []
    let driven = false
    if (animated && VT && railRef.current) {
      try {
        const timeline = new VT({ subject: railRef.current, axis: 'block' })
        const opts = { timeline, rangeStart: 'contain 0%', rangeEnd: 'contain 100%', fill: 'both' } as unknown as KeyframeAnimationOptions
        anims = list.flatMap(([el, frames]) => (el ? [el.animate(frames, opts)] : []))
        driven = anims.every(a => a.timeline === timeline)
      } catch {
        driven = false
      }
      // Se o navegador aceitou só parte, tudo volta pro modo em JS (nada fica fora de sincronia)
      if (!driven) { anims.forEach(a => a.cancel()); anims = [] }
    }
    if (!driven) anims = paused()
    if (!animated) anims.forEach(a => { a.currentTime = 1000 })
    animsRef.current = anims
    scrollDrivenRef.current = driven
    window.dispatchEvent(new Event('scroll'))
    return () => anims.forEach(a => a.cancel())
  }, [layout, animated])

  // Rolagem: liga/desliga cliques e o acender das praias; sem ViewTimeline, também move a animação
  useEffect(() => {
    const stage = stageRef.current
    if (!animated || !stage) return
    let raf = 0
    const tick = () => {
      raf = 0
      const track = trackRef.current
      if (!track || !pinRef.current) return
      const p = clamp01(-track.getBoundingClientRect().top / pinRef.current)
      if (!scrollDrivenRef.current) animsRef.current.forEach(a => { a.currentTime = p * 1000 })
      if (p >= 0.76) stage.dataset.lit = '1'
      else if (p < 0.3) stage.dataset.lit = '0'
      if (heroRef.current) heroRef.current.style.pointerEvents = p <= 0.06 ? '' : 'none'
      if (finalRef.current) finalRef.current.style.pointerEvents = p >= 0.8 ? '' : 'none'
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick) }
    tick()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [animated])

  const k = layout?.k ?? 1
  const base = layout?.wide ? BASE.wide : BASE.tall
  const selected = beaches.find(b => b.id === selectedId) ?? null
  const slotW = BOX.w * k
  const dot = layout && layout.W >= 640 ? 12 : 10

  const stage = (
    <section ref={stageRef} id="ilha" data-lit={animated ? '0' : '1'}
      className={`flyover-sea ${animated ? 'sticky top-0 min-h-lvh' : 'relative'} w-full overflow-hidden`}>
      <div ref={probeRef} className="pointer-events-none absolute inset-x-0 top-0 h-svh" aria-hidden="true" />

      {/* Mundo: satélite da ilha, detalhes perto da Mole e a foto (de baixo pra cima) */}
      {layout && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <img ref={baseRef} src={base.src} alt="" decoding="async"
            className="absolute left-0 top-0 max-w-none origin-top-left"
            style={{ width: base.w * k * baseScale(base, k), height: base.h * k * baseScale(base, k) }} />
          {animated && DETAILS.map((l, i) => (
            <img key={l.src} ref={el => { detailRefs.current[i] = el }} src={l.src} alt="" decoding="async" fetchPriority="low"
              className="absolute left-0 top-0 max-w-none origin-top-left"
              style={{ width: l.w * k * baseScale(l, k), height: l.h * k * baseScale(l, k), opacity: 0 }} />
          ))}
          {animated && (
            <img ref={photoRef} src={PHOTO.src} alt="" fetchPriority="high"
              className="absolute left-0 top-0 max-w-none origin-top-left"
              style={{ width: PHOTO.w * k * layout.s0, height: PHOTO.h * k * layout.s0 }} />
          )}
        </div>
      )}

      {/* Escurecimento em volta da ilha no mapa final (a ilha fica acesa) */}
      <svg ref={dimRef} className="pointer-events-none absolute inset-0 h-full w-full" style={{ opacity: animated ? 0 : 1 }} aria-hidden="true">
        {layout && (
          <>
            <defs>
              <mask id="flyover-island-hole">
                <rect width="100%" height="100%" fill="white" />
                <path d={ISLAND_PATH} fill="black" transform={`translate(${layout.ox} ${layout.oy}) scale(${k})`} />
              </mask>
            </defs>
            <rect width="100%" height="100%" className="flyover-dim" mask="url(#flyover-island-hole)" />
          </>
        )}
      </svg>
      {animated && <div ref={vignetteRef} className="flyover-vignette pointer-events-none absolute inset-x-0 top-0 h-lvh" />}
      {animated && <div ref={scrimRef} className="hero-scrim pointer-events-none absolute inset-x-0 top-0 h-svh" />}
      <div className="flyover-fade-bottom pointer-events-none absolute inset-x-0 bottom-0 h-16" />

      {/* Fim da subida: título, mapa (a ilha do satélite pousa aqui) e lista de praias */}
      <div ref={finalRef} className="relative z-10 mx-auto max-w-3xl px-4 pb-20 text-white" style={{ paddingTop: NAV + 20, opacity: animated ? 0 : 1 }}>
        <div className="text-center">
          <span className="mb-3 inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3.5 py-1 text-xs font-semibold">
            <span className="relative mr-2 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rating-good opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rating-good" />
            </span>
            Mapa em tempo real
          </span>
          <h2 className="mb-2 text-[1.75rem] font-black leading-tight text-balance md:text-4xl" style={{ textShadow: '0 2px 18px oklch(0 0 0 / 0.6)' }}>
            A ilha inteira, de ponta a ponta.
          </h2>
          <p className="text-sm text-balance text-white/85 md:text-base" style={{ textShadow: '0 1px 8px oklch(0 0 0 / 0.8)' }}>
            Do Santinho ao Naufragados, todas em tempo real. Toque numa praia.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-[minmax(0,44%)_minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,34%)_minmax(0,1fr)] sm:gap-6">
          <div ref={slotRef} className="relative self-start" style={{ aspectRatio: `${BOX.w} / ${BOX.h}` }}>
            <svg viewBox={`${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
              <path d={ISLAND_PATH} pathLength={1} fill="none" stroke="white" strokeOpacity={0.85} strokeWidth={1.4 / k} strokeLinejoin="round" className="flyover-outline" />
            </svg>
            {beaches.map((b, i) => {
              const info = getRatingInfo(b.score)
              const active = b.id === selectedId
              const size = active ? dot + 6 : dot
              return (
                <button key={b.id} type="button" onClick={() => pick(b.id)} aria-label={`${b.name}, nota ${b.score.toFixed(1)}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 p-1.5 focus-visible:outline-none"
                  style={{ left: (b.pos.x - BOX.x) * k, top: (b.pos.y - BOX.y) * k, zIndex: active ? 2 : 1 }}>
                  <span className="relative block">
                    {active && <span className="absolute inset-0 animate-ping rounded-full" style={{ background: info.scoreColor, opacity: 0.6 }} />}
                    <span className="flyover-dot relative block rounded-full"
                      style={{ width: size, height: size, background: info.scoreColor, boxShadow: `0 0 0 2px white, 0 0 10px ${info.scoreColor}`, animationDelay: `${i * 70}ms` }} />
                  </span>
                </button>
              )
            })}
            {selected && (() => {
              const label = `${selected.name} · ${selected.score.toFixed(1)}`
              const w = label.length * 6.4 + 22
              const x = (selected.pos.x - BOX.x) * k
              const y = (selected.pos.y - BOX.y) * k
              const left = Math.min(Math.max(x - w / 2, -6), slotW + 48 - w)
              return (
                <div className="pointer-events-none absolute z-10 whitespace-nowrap rounded-full border border-white/30 bg-black/75 px-2.5 py-1 text-center text-[11px] font-bold text-white"
                  style={{ left, top: y > 40 ? y - 38 : y + 16, width: w, animation: 'fadeIn 0.2s ease-out' }}>
                  {label}
                </div>
              )
            })()}
          </div>
          <IslandBeachList beaches={beaches} selectedId={selectedId} onPick={pick} />
        </div>

        <div className="mt-4" style={{ textShadow: '0 1px 6px oklch(0 0 0 / 0.9)' }}>
          <IslandSummary summary={summary} className="text-white/90" />
        </div>
        <p className="mt-4 text-center text-[10px] leading-relaxed text-white/50">
          Foto: Tiago Muraro (Unsplash). Aerofoto: Governo de Santa Catarina (SDS, 2012). Satélite: contém dados modificados do Copernicus Sentinel (2026), ESA. Contorno: © colaboradores do OpenStreetMap.
        </p>
      </div>

      {animated && (
        <>
          {/* Texto do topo, centralizado na parte visível ao abrir a página (o palco começa logo abaixo do menu) */}
          <div ref={heroRef} className="absolute inset-x-0 top-0 z-20 flex flex-col items-center justify-center px-5 pb-16 pt-4 text-center" style={{ height: `calc(100svh - ${NAV}px)` }}>
            {hero}
          </div>
          <div ref={cueRef} className="pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-1 text-xs font-medium text-white/80" style={{ top: `calc(100svh - ${NAV}px - 56px)` }} aria-hidden="true">
            Role e veja a ilha de cima
            <ChevronDown className="h-5 w-5 animate-bounce" />
          </div>
        </>
      )}
    </section>
  )

  if (!animated) return <div className="relative z-10">{stage}</div>

  return (
    <div ref={trackRef} className="relative z-10">
      <div ref={railRef} className="pointer-events-none absolute inset-x-0 top-0" aria-hidden="true" />
      {stage}
      <div style={{ height: `${PIN_SVH}svh` }} aria-hidden="true" />
    </div>
  )
}
