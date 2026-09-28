import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import aerialBg from '@/assets/landing/aerial-floripa.jpg'
import satTall from '@/assets/landing/satellite-island-tall.webp'
import satWide from '@/assets/landing/satellite-island-wide.webp'
import satDetail from '@/assets/landing/satellite-mole-detail.webp'
import { getRatingInfo } from '@/lib/rating'
import { ISLAND_PATH, ISLAND_VIEWBOX, projectLatLng } from '@/components/landing/islandShape'
import { IslandSummary } from '@/components/landing/IslandMap'
import { useIslandBeaches } from '@/components/landing/useIslandBeaches'

// Topo da landing com a transição "a câmera sobe" (plano D, 29/set/2026): rolando, a foto do topo
// se afasta e vira a ilha inteira vista de satélite; o contorno se desenha por cima, as 14 praias
// acendem de norte a sul na cor da nota de agora e o satélite escurece pro título do mapa.
// Substitui as ondas desenhadas da passagem foto → página, que o usuário não gostou.
//
// Como funciona: uma faixa de rolagem alta (TRACK) com um palco preso na tela (sticky). O
// progresso da rolagem (0 → 1) move só transform/opacity de poucas camadas, direto no DOM (sem
// re-render do React a cada quadro). O palco NUNCA fica vazio: o satélite está sempre por baixo
// da foto, e a foto só some depois que ele já ocupa a tela — a versão antiga com palco preso
// (corrigida em f9c98fc) deixava uma faixa de rolagem com a tela preta.
// Quem pede menos movimento no sistema vê a foto e, logo abaixo, a ilha já montada, sem palco.
//
// Imagem de satélite: Copernicus Sentinel-2 (ESA), cena S2B_22JGQ_20260821 (21/ago/2026, sem
// nuvem), recortada e reprojetada pro MESMO sistema do desenho da ilha (islandShape.ts), então
// os pontos de projectLatLng caem em cima das praias reais. Crédito na seção logo abaixo.

const TRACK = '300svh'
const NAV = 60 // menu fixo do topo da landing, por cima do palco
// Recortes do satélite em unidades do desenho da ilha (x/y de projectLatLng)
const SAT = {
  tall: { src: satTall, x: -200, y: -290, w: 640, h: 980 },
  wide: { src: satWide, x: -425, y: -110, w: 1145, h: 780 },
}
// Recorte mais nítido (5 px por unidade, ~18 m por pixel) em volta da Mole/Joaquina, por cima do
// geral, pro começo da subida não ficar borrado no celular; borda esfumada (.flyover-detail-mask)
const DETAIL = { src: satDetail, x: 91, y: 120, w: 140, h: 300 }
const BOX = { x: -14, y: -8, w: ISLAND_VIEWBOX.width + 28, h: ISLAND_VIEWBOX.height + 16 }
// A câmera começa perto da Praia Mole (foto do topo espelhada: mar à direita, como na costa leste)
const FOCUS = projectLatLng(-27.6022459, -48.4326839)

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a))
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const easeOutBack = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2)

type Layout = { W: number; H: number; wide: boolean; k: number; ox: number; oy: number }

// Onde a ilha fica na tela no quadro final: no celular, embaixo do título + legenda, com uma
// folga no pé pra saída esfumada; em tela larga, à direita do texto
function computeLayout(W: number, H: number, headH: number): Layout {
  const wide = W >= 768 && W / H >= 1.1
  if (wide) {
    const k = Math.min((H - NAV - 48) / BOX.h, (W - 560) / BOX.w)
    const islandW = ISLAND_VIEWBOX.width * k
    const ox = Math.max((W - islandW) / 2, 500 + 14 * k)
    const oy = NAV + 24 + (H - NAV - 48 - BOX.h * k) / 2 + 8 * k
    return { W, H, wide, k, ox, oy }
  }
  const top = headH + 8 // headH já inclui o espaço do menu (paddingTop do título)
  const bottom = 36
  const k = Math.max(0.35, Math.min((H - top - bottom) / BOX.h, (W - 24) / BOX.w))
  const ox = (W - ISLAND_VIEWBOX.width * k) / 2
  const oy = top + Math.max(0, (H - top - bottom - BOX.h * k) / 2) + 8 * k
  return { W, H, wide, k, ox, oy }
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
    return (
      <>
        <div className="relative z-10 flex w-full items-center justify-center overflow-hidden px-5 pb-16 pt-10 text-center" style={{ minHeight: 'clamp(560px, 82svh, 800px)' }}>
          <HeroPhoto />
          <div className="relative z-10">{children}</div>
        </div>
        <IslandStage />
      </>
    )
  }
  return <IslandStage hero={children} />
}

function HeroPhoto({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0" style={mirrored ? { transform: 'scaleX(-1)' } : undefined}>
        <img
          src={aerialBg}
          alt="Vista aérea de uma praia de Florianópolis"
          width={1000}
          height={1791}
          fetchPriority="high"
          className="h-full w-full object-cover"
          style={{ animation: 'heroZoom 26s ease-in-out infinite alternate' }}
        />
      </div>
      {/* Escurecimento da foto (.hero-scrim em index.css), mais forte onde fica o texto */}
      <div className="hero-scrim absolute inset-0" />
    </div>
  )
}

// hero presente = palco com rolagem (foto → satélite → mapa); sem hero = ilha já montada, parada
function IslandStage({ hero }: { hero?: ReactNode }) {
  const animated = hero !== undefined
  const { beaches, summary } = useIslandBeaches()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const trackRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null) // área visível garantida (100svh)
  const headRef = useRef<HTMLDivElement>(null)
  const satRef = useRef<HTMLImageElement>(null)
  const detailRef = useRef<HTMLImageElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const outlineRef = useRef<SVGPathElement>(null)
  const dotRefs = useRef<(SVGGElement | null)[]>([])
  const dimRef = useRef<HTMLDivElement>(null)
  const photoRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const cueRef = useRef<HTMLDivElement>(null)
  const finalRef = useRef<HTMLDivElement>(null)
  const fadeRef = useRef<HTMLDivElement>(null)

  const [layout, setLayout] = useState<Layout | null>(null)
  const layoutRef = useRef<Layout | null>(null)
  const pRef = useRef(animated ? 0 : 1)

  // Mede o palco, o título e a legenda sempre que o tamanho muda
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const measure = () => {
      const next = computeLayout(box.clientWidth, box.clientHeight, headRef.current?.offsetHeight ?? 190)
      setLayout(prev => (prev && Object.keys(next).every(key => prev[key as keyof Layout] === next[key as keyof Layout]) ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    if (headRef.current) ro.observe(headRef.current)
    return () => ro.disconnect()
  }, [])

  // Aplica o quadro do progresso p (0 = foto do topo, 1 = ilha montada). Só lê refs, então é
  // estável e pode ser chamado de qualquer efeito.
  const apply = useCallback((p: number) => {
    const L = layoutRef.current
    if (!L) return
    const S0 = L.wide ? 3 : 4

    // 1. Texto do topo sai subindo
    const tText = seg(p, 0, 0.1)
    if (heroRef.current) {
      heroRef.current.style.opacity = String(1 - tText)
      heroRef.current.style.transform = `translate3d(0, ${-48 * tText}px, 0)`
      heroRef.current.style.visibility = tText >= 1 ? 'hidden' : 'visible'
    }
    if (cueRef.current) cueRef.current.style.opacity = String(1 - seg(p, 0, 0.04))

    // 2. Foto se afasta (encolhe com borda macia) e dissolve no satélite
    if (photoRef.current) {
      const tp = easeInOut(seg(p, 0.02, 0.32))
      const soft = easeOut(seg(p, 0, 0.07))
      const op = 1 - seg(p, 0.1, 0.32)
      const st = photoRef.current.style
      st.transform = `scale(${1 - 0.4 * tp})`
      st.opacity = String(op)
      st.visibility = op <= 0 ? 'hidden' : 'visible'
      const ms = `${300 - 200 * soft}% ${300 - 200 * soft}%`
      st.maskSize = ms
      st.setProperty('-webkit-mask-size', ms)
    }

    // 3. Satélite: zoom de perto da Praia Mole até a ilha inteira (escala em progressão
    //    geométrica, que é como uma câmera subindo parece pro olho). O transform vai direto
    //    na <img>: o navegador amplia a própria imagem na placa de vídeo, sem redesenhar nada.
    const tz = easeInOut(seg(p, 0, 0.5))
    const s = Math.pow(S0, 1 - tz)
    const fx = L.ox + FOCUS.x * L.k, fy = L.oy + FOCUS.y * L.k
    const zoom = `translate3d(${(L.W / 2 - fx) * (1 - tz)}px, ${(L.H / 2 - fy) * (1 - tz)}px, 0) scale(${s})`
    for (const [img, crop] of [[satRef.current, L.wide ? SAT.wide : SAT.tall], [detailRef.current, DETAIL]] as const) {
      if (!img) continue
      img.style.transformOrigin = `${fx - (L.ox + crop.x * L.k)}px ${fy - (L.oy + crop.y * L.k)}px`
      img.style.transform = zoom
    }

    // 4. Contorno da ilha se desenha
    // (o desenho só aparece com o zoom já terminado, então fica parado, sem transform)
    if (overlayRef.current) overlayRef.current.style.visibility = p >= 0.5 ? 'visible' : 'hidden'
    const tLine = seg(p, 0.5, 0.66)
    if (outlineRef.current) {
      outlineRef.current.style.strokeDashoffset = String(1 - tLine)
      outlineRef.current.style.opacity = tLine > 0 ? '1' : '0'
    }

    // 5. Praias acendem de norte a sul
    const n = dotRefs.current.length
    const tDots = seg(p, 0.58, 0.82) * (n + 1.5)
    dotRefs.current.forEach((g, i) => {
      if (!g) return
      const t = clamp01((tDots - i) / 1.5)
      g.style.opacity = String(t)
      g.style.transform = `scale(${t <= 0 ? 0.2 : t >= 1 ? 1 : 0.2 + 0.8 * easeOutBack(t)})`
    })
    if (overlayRef.current) overlayRef.current.style.pointerEvents = p > 0.8 ? 'auto' : 'none'

    // 6. Satélite escurece, entra o título do mapa; no fim, a base funde no fundo da página
    const tFinal = seg(p, 0.7, 0.9)
    if (dimRef.current) dimRef.current.style.opacity = String(0.42 * tFinal)
    if (finalRef.current) {
      finalRef.current.style.opacity = String(tFinal)
      finalRef.current.style.transform = `translate3d(0, ${18 * (1 - easeOut(tFinal))}px, 0)`
    }
    if (fadeRef.current) fadeRef.current.style.opacity = String(seg(p, 0.86, 1))
  }, [])

  // Rolagem → progresso
  useEffect(() => {
    if (!animated) {
      apply(1)
      return
    }
    let raf = 0
    const tick = () => {
      raf = 0
      const track = trackRef.current, box = boxRef.current
      if (!track || !box) return
      const r = track.getBoundingClientRect()
      const dist = r.height - window.innerHeight
      pRef.current = dist > 0 ? clamp01(-r.top / dist) : 1
      apply(pRef.current)
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
  }, [animated, apply])

  // Quadro atual de novo quando muda o tamanho ou chegam as notas das praias
  useLayoutEffect(() => {
    layoutRef.current = layout
    dotRefs.current.length = beaches.length
    apply(pRef.current)
  }, [layout, beaches, apply])

  const sat = layout?.wide ? SAT.wide : SAT.tall
  const k = layout?.k ?? 1
  const selected = beaches.find(b => b.id === selectedId) ?? null
  const dotR = (layout?.wide ? 8 : 6.5) / k

  const islandLayer = layout && (
    <>
      {/* Satélite (camada de baixo, sempre presente) */}
      <img
        ref={satRef}
        src={sat.src}
        alt=""
        aria-hidden="true"
        decoding="async"
        fetchPriority="low"
        className="flyover-sat-edges absolute max-w-none will-change-transform"
        style={{ left: layout.ox + sat.x * k, top: layout.oy + sat.y * k, width: sat.w * k, height: sat.h * k }}
      />
      {animated && (
        <img
          ref={detailRef}
          src={DETAIL.src}
          alt=""
          aria-hidden="true"
          decoding="async"
          fetchPriority="low"
          className="flyover-detail-mask absolute max-w-none will-change-transform"
          style={{ left: layout.ox + DETAIL.x * k, top: layout.oy + DETAIL.y * k, width: DETAIL.w * k, height: DETAIL.h * k }}
        />
      )}
      <div ref={dimRef} className="flyover-dim absolute inset-0" style={{ opacity: 0 }} />
      {/* Contorno + praias, no mesmo sistema de coordenadas do satélite */}
      <div ref={overlayRef} className="absolute inset-0" style={{ pointerEvents: 'none', visibility: animated ? 'hidden' : 'visible' }}>
        <svg
          viewBox={`${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}`}
          className="absolute overflow-visible"
          style={{ left: layout.ox + BOX.x * k, top: layout.oy + BOX.y * k, width: BOX.w * k, height: BOX.h * k }}
          role="img"
          aria-label="Ilha de Santa Catarina vista de satélite, com as praias coloridas pela nota de agora"
        >
          <path ref={outlineRef} d={ISLAND_PATH} pathLength={1} fill="none" stroke="white" strokeOpacity={0.9}
            strokeWidth={1.6 / k} strokeLinejoin="round" strokeDasharray="1" style={{ strokeDashoffset: 1, opacity: 0, filter: 'drop-shadow(0 0 4px oklch(0.85 0.1 200 / 0.8))' }} />
          {beaches.map((b, i) => {
            const info = getRatingInfo(b.score)
            const active = b.id === selectedId
            return (
              <g key={b.id} ref={el => { dotRefs.current[i] = el }} onClick={() => setSelectedId(prev => (prev === b.id ? null : b.id))}
                className="cursor-pointer" style={{ transformBox: 'fill-box', transformOrigin: 'center', opacity: 0 }}>
                <circle cx={b.pos.x} cy={b.pos.y} r={dotR * 2} fill={info.scoreColor} opacity={active ? 0.5 : 0.3} />
                <circle cx={b.pos.x} cy={b.pos.y} r={active ? dotR * 1.3 : dotR} fill={info.scoreColor} stroke="white" strokeWidth={2 / k} />
                <circle cx={b.pos.x} cy={b.pos.y} r={18 / k} fill="transparent" />
              </g>
            )
          })}
          {selected && (() => {
            const fs = 13 / k
            const label = `${selected.name}  ${selected.score.toFixed(1)}`
            const w = label.length * fs * 0.6 + 22 / k
            const cxl = Math.min(Math.max(selected.pos.x, BOX.x + w / 2), BOX.x + BOX.w - w / 2)
            const cyl = selected.pos.y - 26 / k
            return (
              <g pointerEvents="none" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                <rect x={cxl - w / 2} y={cyl - 13 / k} width={w} height={26 / k} rx={13 / k} fill="oklch(0.18 0.03 245 / 0.9)" stroke="white" strokeOpacity={0.35} strokeWidth={1 / k} />
                <text x={cxl} y={cyl + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight="700" fill="white">{label}</text>
              </g>
            )
          })()}
        </svg>
      </div>
    </>
  )

  const finalText = (
    <div ref={finalRef} className="pointer-events-none absolute inset-0 text-white" style={{ opacity: animated ? 0 : 1 }}>
      <div ref={headRef}
        className={layout?.wide
          ? 'absolute left-12 top-1/2 max-w-[400px] -translate-y-1/2 text-left'
          : 'mx-auto max-w-xl px-5 text-center'}
        style={layout?.wide ? undefined : { paddingTop: NAV + 12 }}>
        <span className="mb-3 inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3.5 py-1 text-xs font-semibold backdrop-blur-sm">
          <span className="relative mr-2 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rating-good opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rating-good" />
          </span>
          Mapa em tempo real
        </span>
        <h2 className="mb-2 text-3xl font-black text-balance md:text-5xl" style={{ textShadow: '0 2px 18px oklch(0 0 0 / 0.6)' }}>
          A ilha inteira, de ponta a ponta.
        </h2>
        <p className="text-sm text-balance text-white/85 md:text-lg" style={{ textShadow: '0 1px 8px oklch(0 0 0 / 0.8)' }}>
          Do Santinho ao Naufragados, todas em tempo real.
        </p>
        <div className="min-h-[18px]" style={{ textShadow: '0 1px 6px oklch(0 0 0 / 0.9)' }}>
          <IslandSummary summary={summary} className={layout?.wide ? 'mt-5 !justify-start text-white/90' : 'mt-3 text-white/90'} />
        </div>
      </div>
    </div>
  )

  if (!animated) {
    return (
      <div className="flyover-sea relative z-10 h-svh w-full overflow-hidden">
        <div ref={boxRef} className="absolute inset-0">
          {islandLayer}
          {finalText}
        </div>
      </div>
    )
  }

  return (
    <div ref={trackRef} className="relative z-10 w-full" style={{ height: TRACK }}>
      <div className="flyover-sea sticky top-0 h-lvh w-full overflow-hidden">
        {/* Tudo que precisa ser visto fica dentro de 100svh (no iPhone, a barra do navegador
            cobre a diferença entre svh e lvh); o fundo ocupa a tela toda */}
        {islandLayer}
        <div ref={fadeRef} className="flyover-fade-bottom pointer-events-none absolute inset-x-0 bottom-0 h-16" style={{ opacity: 0 }} />
        <div ref={photoRef} className="flyover-photo-mask absolute inset-0 will-change-transform" style={{ maskSize: '300% 300%', WebkitMaskSize: '300% 300%' }}>
          <HeroPhoto mirrored />
        </div>
        <div ref={boxRef} className="absolute inset-x-0 top-0 h-svh">
          {finalText}
          {/* Centralizado na parte visível ao abrir a página (o palco começa logo abaixo do menu) */}
          <div ref={heroRef} className="absolute inset-x-0 top-0 z-10 flex flex-col items-center justify-center px-5 pb-16 pt-4 text-center" style={{ height: `calc(100svh - ${NAV}px)` }}>
            {hero}
          </div>
          <div ref={cueRef} className="pointer-events-none absolute inset-x-0 z-10 flex flex-col items-center gap-1 text-xs font-medium text-white/80" style={{ top: `calc(100svh - ${NAV}px - 56px)` }} aria-hidden="true">
            Role e veja a ilha de cima
            <ChevronDown className="h-5 w-5 animate-bounce" />
          </div>
        </div>
      </div>
    </div>
  )
}
