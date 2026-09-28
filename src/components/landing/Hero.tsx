import type { ReactNode } from 'react'
import aerialBg from '@/assets/landing/aerial-floripa.jpg'

// Hero estático: a mesma foto aérea da ilha, sem vídeo e sem scroll-jacking.
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
          maskImage: 'linear-gradient(to bottom, black 0%, black 68%, transparent 92%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 68%, transparent 92%)',
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

      {/* recorte em onda — separa a foto do conteúdo abaixo, em vez de um corte reto */}
      <svg className="absolute inset-x-0 bottom-0 w-full" viewBox="0 0 1440 160" preserveAspectRatio="none"
        style={{ height: '11vh', minHeight: 64, maxHeight: 120 }} aria-hidden="true">
        <path d="M0,64 C 220,120 380,10 620,58 C 860,106 1040,14 1440,70 L1440,160 L0,160 Z" fill="var(--background)" />
      </svg>

      <div className="relative z-10 flex min-h-[inherit] flex-col items-center justify-center px-5 pb-24 pt-10 text-center">
        {children}
      </div>
    </div>
  )
}
