import { useRef } from 'react'
import { Crown } from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'
import cardPhoto from '@/assets/premium/card-mole.webp'

// Carteirinha Premium (08/out/2026): o usuário achou a página Premium "feia, simples, não parece
// que estou adquirindo uma coisa muito boa". A carteirinha mostra o que a pessoa leva, com o nome
// dela e o plano escolhido, em cima da foto real da Praia Mole (Unsplash, Tiago Muraro — a mesma
// do topo da landing; recorte em assets/premium/card-mole.webp). Sem chip nem número de propósito:
// fica logo acima do formulário do cartão de crédito e não pode ser confundida com um.
// Entra "deitando pra frente", flutua de leve e inclina com o dedo/mouse (estilos em index.css).

const MAX_TILT = 9

export function MembershipCard({ holder, plan, detail }: { holder: string; plan: string; detail: string }) {
  const tiltRef = useRef<HTMLDivElement>(null)

  const tilt = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = tiltRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.transform = `perspective(900px) rotateX(${(-y * MAX_TILT).toFixed(2)}deg) rotateY(${(x * MAX_TILT).toFixed(2)}deg)`
  }
  const reset = () => { if (tiltRef.current) tiltRef.current.style.transform = '' }

  return (
    <div className="mx-auto w-full max-w-[22rem]" style={{ animation: 'memberRise 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) both' }}>
      <div style={{ animation: 'memberFloat 6s ease-in-out 1s infinite' }}>
        <div
          ref={tiltRef}
          onPointerMove={tilt}
          onPointerLeave={reset}
          onPointerUp={reset}
          className="relative aspect-[1.586] select-none overflow-hidden rounded-2xl shadow-2xl shadow-primary/25 ring-1 ring-white/15 transition-transform duration-200 ease-out"
          role="img"
          aria-label={`Carteirinha Surf AI Premium de ${holder}, plano ${plan}`}
        >
          <img src={cardPhoto} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
          <div className="member-card-scrim absolute inset-0" />
          <div className="member-card-sheen pointer-events-none absolute inset-0" />

          <div className="relative flex h-full flex-col justify-between p-4 text-left text-white">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-1.5">
                <AppLogo size={22} variant="icon" />
                <span className="text-sm font-bold tracking-tight">Surf AI</span>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-bold tracking-[0.18em] text-rating-fair backdrop-blur-sm">
                <Crown className="h-3 w-3" />PREMIUM
              </span>
            </div>

            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/60">Surfista</div>
                <div className="truncate text-base font-bold uppercase tracking-wide">{holder}</div>
                <div className="text-[10px] text-white/70">Floripa · 14 praias</div>
              </div>
              {/* key: troca de plano refaz a entrada do texto */}
              <div key={plan + detail} className="anim-fade shrink-0 text-right">
                <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/60">{plan}</div>
                <div className="text-sm font-bold tabular-nums">{detail}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
