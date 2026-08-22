import { useEffect } from 'react'

// Trava o scroll do <body> enquanto um modal customizado ("fixed inset-0") está
// aberto. Sem isso, no celular (principalmente iOS Safari) o dedo continua
// arrastando a página escondida atrás do modal — sensação de scroll "sem
// fundamento", já que o que se vê na tela (o modal) não se move.
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [active])
}
