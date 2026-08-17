import { useEffect, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'

// Passos reais do pipeline (fetch de condições -> score -> geração do texto via OpenAI),
// não um "raciocínio" inventado — inspirado no padrão "AI Thinking" do 21st dev, mas sem
// fabricar conteúdo (mesmo motivo pelo qual removemos os depoimentos falsos da Landing).
const STEPS = [
  'Cruzando ondas, vento e maré...',
  'Comparando com as 14 praias...',
  'Escrevendo o relatório do dia...',
]

export function AIThinkingIndicator() {
  const [stepIndex, setStepIndex] = useState(0)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const stepInterval = setInterval(() => setStepIndex(i => (i + 1) % STEPS.length), 1600)
    const timer = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => { clearInterval(stepInterval); clearInterval(timer) }
  }, [])

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Spinner className="size-3.5 text-primary" />
      <span className="animate-pulse">{STEPS[stepIndex]}</span>
      <span aria-label={`${seconds} segundos`}>{seconds}s</span>
    </div>
  )
}
