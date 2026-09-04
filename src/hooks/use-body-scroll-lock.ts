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
//
// 31/ago/2026: overflow:hidden sozinho não é suficiente no Safari iOS — o teclado abrindo
// atrás de um modal "fixed inset-0" (ex: chat com campo de texto) ainda deixava o conteúdo
// de trás vazar visualmente, reportado pelo usuário com print real. overflow:hidden só
// impede o SCROLL, não corrige o iOS recalcular o viewport visual quando o teclado abre;
// fixar o próprio body na posição atual (position:fixed + top negativo = scrollY atual) é a
// técnica padrão que resolve os dois problemas juntos. Restaura a posição exata de scroll
// ao destravar, senão a página "pula" pro topo quando o modal fecha.
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const scrollY = window.scrollY
    const elements = [document.documentElement, document.body]
    const original = elements.map(el => ({ overflow: el.style.overflow, touchAction: el.style.touchAction }))
    elements.forEach(el => { el.style.overflow = 'hidden'; el.style.touchAction = 'none' })
    const bodyOriginal = { position: document.body.style.position, top: document.body.style.top, width: document.body.style.width }
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    return () => {
      elements.forEach((el, i) => {
        el.style.overflow = original[i].overflow
        el.style.touchAction = original[i].touchAction
      })
      document.body.style.position = bodyOriginal.position
      document.body.style.top = bodyOriginal.top
      document.body.style.width = bodyOriginal.width
      window.scrollTo(0, scrollY)
    }
  }, [active])
}
