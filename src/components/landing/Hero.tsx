import type { ReactNode } from 'react'
import aerialBg from '@/assets/landing/aerial-floripa.jpg'

// Hero: a mesma foto aérea da ilha, sem vídeo e sem scroll-jacking; no rodapé, ondas animadas
// fazem a passagem pro resto da página (ver comentário da transição abaixo).
// Rolagem normal (nada de `sticky`/pin) — a foto tem uma máscara de gradiente
// que dissolve ela direto na cor de fundo real da página (var(--background),
// funciona nos dois temas), com um recorte em forma de onda no rodapé
// (referência do usuário: site Aloha Waveland, foto "rasgada" por uma onda
// em vez de um corte reto). Como não há pin nenhum, a seção de baixo já está
// ali, logo abaixo, sem intervalo — rolar simplesmente revela ela, sem tela
// preta no meio (era o que acontecia na versão anterior, que prendia a foto
// na tela por uma faixa extra de rolagem depois dela já ter sumido).
export function Hero({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-full overflow-hidden" style={{ minHeight: 'clamp(600px, 88svh, 840px)', background: 'var(--background)' }}>
      <div className="absolute inset-0"
        style={{
          maskImage: 'linear-gradient(to bottom, black 0%, black 74%, transparent 97%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 74%, transparent 97%)',
        }}>
        <img
          src={aerialBg}
          alt="Vista aérea da ilha de Florianópolis"
          width={1000}
          height={1791}
          fetchPriority="high"
          className="h-full w-full object-cover"
          style={{ animation: 'heroZoom 26s ease-in-out infinite alternate' }}
        />
        {/* Escurecimento da foto (.hero-scrim em index.css), mais forte onde fica o texto */}
        <div className="hero-scrim absolute inset-0" />
      </div>

      {/* Transição foto → página (29/set/2026, ideia do usuário: "o mar azul que desce pra
          espuma da onda"): três camadas de onda correndo devagar, uma atrás da outra: mar azul,
          linha de espuma e, na frente, a cor de fundo da página. Cada onda é um desenho que se
          repete a cada 1440 unidades, então deslizar metade da largura fecha o ciclo sem emenda. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[150px] overflow-hidden sm:h-[180px]" aria-hidden="true">
        {[
          { fill: 'color-mix(in oklch, var(--primary) 50%, var(--background))', dy: 18, dur: '19s', opacity: 0.7 },
          { fill: 'color-mix(in oklch, white 80%, var(--primary))', dy: 52, dur: '13s', opacity: 0.4, reverse: true },
          { fill: 'var(--background)', dy: 74, dur: '25s', opacity: 1 },
        ].map((w, i) => (
          <svg key={i} className="hero-wave absolute bottom-0 left-0 h-full w-[200%]" viewBox="0 0 2880 180" preserveAspectRatio="none"
            style={{ animationDuration: w.dur, animationDirection: w.reverse ? 'reverse' : 'normal' }}>
            <path transform={`translate(0 ${w.dy})`} fill={w.fill} opacity={w.opacity}
              d="M0 40 C 240 0, 480 0, 720 40 S 1200 80, 1440 40 S 1920 0, 2160 40 S 2640 80, 2880 40 L 2880 200 L 0 200 Z" />
          </svg>
        ))}
      </div>

      <div className="relative z-10 flex min-h-[inherit] flex-col items-center justify-center px-5 pb-24 pt-10 text-center">
        {children}
      </div>
    </div>
  )
}
