import { X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getScoreColor, getScoreLabel } from '@/lib/rating'

// Cartão de uma praia no topo da tela Comparar Praias. Saiu de Compare.tsx em 08/out/2026 pra
// página Premium mostrar o MESMO cartão no exemplo de comparação (sem o botão de tirar).

export function CompareSpotCard({ index, score, name, region, onRemove }: {
  index: number
  score: number
  name: string
  region: string
  onRemove?: () => void
}) {
  const color = getScoreColor(score)
  return (
    <Card className="relative overflow-hidden" style={{ animation: `slideUp 0.3s ${index * 0.1}s ease-out both` }}>
      <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: color }} />
      <CardContent className="pt-5 pb-4 text-center">
        {onRemove && (
          <button
            onClick={onRemove}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted/50 transition-colors"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
        <div className="text-3xl font-bold mb-0.5" style={{ color }}>{score.toFixed(1)}</div>
        <div className="text-xs font-bold mb-2" style={{ color }}>{getScoreLabel(score)}</div>
        <div className="font-semibold text-sm leading-tight">{name}</div>
        <div className="text-xs text-muted-foreground">{region}</div>
      </CardContent>
    </Card>
  )
}
