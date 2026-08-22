import { useEffect } from 'react'

// Trava o scroll da página enquanto um modal customizado ("fixed inset-0") está
// aberto. Sem isso, no celular o dedo continua arrastando a página escondida atrás
// do modal — sensação de scroll "sem fundamento", já que o que se vê na tela (o
// modal) não se move.
//
// Trava tanto <html> quanto <body>: o elemento que de fato rola varia por layout
// (nesse app é o <html>, não o <body> — confirmado testando ao vivo: travar só o
// body não impedia nada, document.documentElement.scrollTop continuava mudando).
// touchAction:'none' é reforço extra pro touch-scroll em navegadores mobile.
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const elements = [document.documentElement, document.body]
    const original = elements.map(el => ({ overflow: el.style.overflow, touchAction: el.style.touchAction }))
    elements.forEach(el => { el.style.overflow = 'hidden'; el.style.touchAction = 'none' })
    return () => {
      elements.forEach((el, i) => {
        el.style.overflow = original[i].overflow
        el.style.touchAction = original[i].touchAction
      })
    }
  }, [active])
}
