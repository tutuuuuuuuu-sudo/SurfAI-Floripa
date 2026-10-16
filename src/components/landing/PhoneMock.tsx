import type { ReactNode } from 'react'
import { Signal, Wifi, BatteryFull } from 'lucide-react'

// Moldura de celular realista pros prints do app na landing (29/set/2026): o usuário achou que
// a versão anterior (só a imagem com borda arredondada, inclinada) "nem parece um celular".
// Aqui tem borda metálica, ilha da câmera, barra de status e botões laterais. As cores da
// moldura são fixas de propósito: representam o aparelho, não o tema do app.
export function PhoneMock({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      {/* botões laterais */}
      <span className="absolute -left-[3px] top-[96px] h-7 w-[3px] rounded-l bg-[#2b2e33]" aria-hidden="true" />
      <span className="absolute -left-[3px] top-[140px] h-12 w-[3px] rounded-l bg-[#2b2e33]" aria-hidden="true" />
      <span className="absolute -left-[3px] top-[196px] h-12 w-[3px] rounded-l bg-[#2b2e33]" aria-hidden="true" />
      <span className="absolute -right-[3px] top-[160px] h-16 w-[3px] rounded-r bg-[#2b2e33]" aria-hidden="true" />

      <div className="relative rounded-[3rem] bg-[#0a0b0d] p-[10px]"
        style={{ boxShadow: 'inset 0 0 0 2px #3b3f45, inset 0 0 0 4px #15171a, 0 30px 70px oklch(0 0 0 / 0.55), 0 0 90px color-mix(in oklch, var(--primary) 12%, transparent)' }}>
        <div className="relative overflow-hidden rounded-[2.4rem] bg-[#0b1116]">
          {/* barra de status + ilha da câmera */}
          <div className="relative flex h-11 items-center justify-between px-7 text-[13px] font-semibold text-white">
            <span className="tabular-nums">9:41</span>
            <span className="absolute left-1/2 top-2.5 h-[26px] w-[86px] -translate-x-1/2 rounded-full bg-black" aria-hidden="true" />
            <span className="flex items-center gap-1">
              <Signal className="h-3.5 w-3.5" /><Wifi className="h-3.5 w-3.5" /><BatteryFull className="h-4 w-4" />
            </span>
          </div>
          {children}
          {/* barrinha de gesto na base */}
          <span className="absolute bottom-2 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-white/70" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
