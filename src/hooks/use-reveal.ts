import { useEffect, useRef, useState } from 'react'

// Animação de entrada no scroll: vira true (uma vez só) quando o elemento aparece na tela.
// Usado pelo Reveal da landing e pela faixa de dias da página Premium.
export function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold])
  return { ref, visible }
}
