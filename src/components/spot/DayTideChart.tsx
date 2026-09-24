import { useMemo } from 'react'

// Versão simplificada de TideChart.tsx pra um dia QUALQUER da previsão de 14 dias — sem o
// marcador "Agora" (não faz sentido pra um dia futuro) e sem interação de hover/expandir,
// só a curva do dia inteiro com os picos de maré alta/baixa marcados.
interface DayTideChartProps {
  heights: number[] // horas do dia (index 0 = 00h), pelo menos ~20 valores
}

export function DayTideChart({ heights }: DayTideChartProps) {
  const chart = useMemo(() => {
    const points: { hour: number; height: number }[] = []
    for (let h = 0; h <= 24; h += 0.25) {
      const i = Math.min(heights.length - 1, Math.floor(h))
      const frac = h - Math.floor(h)
      const h0 = heights[i] ?? 0
      const h1 = heights[Math.min(heights.length - 1, i + 1)] ?? h0
      points.push({ hour: h, height: Number((h0 + (h1 - h0) * frac).toFixed(2)) })
    }
    const allH = points.map(p => p.height)
    const midLevel = (Math.max(...allH) + Math.min(...allH)) / 2
    const amplitude = (Math.max(...allH) - Math.min(...allH)) / 2

    // Detecta pico/vale na altura HORÁRIA crua (não nos pontos interpolados a cada 0.25h)
    // e usa >=/<= em vez de >/< — nos pontos interpolados, o arredondamento de 2 casas
    // decimais às vezes empata o pico com o vizinho, e uma comparação estrita perdia o
    // evento inteiro (achado 24/set/2026, testando com dado sintético: curva desenhava
    // certo, mas nenhum marcador de Alta/Baixa aparecia).
    const tideEvents: { hour: number; type: 'alta' | 'baixa'; height: number }[] = []
    for (let i = 1; i < heights.length - 1; i++) {
      const prev = heights[i - 1], curr = heights[i], next = heights[i + 1]
      const last = tideEvents[tideEvents.length - 1]
      if (curr >= prev && curr >= next && curr > midLevel + amplitude * 0.15) {
        if (!last || last.type !== 'alta' || i - last.hour > 1) tideEvents.push({ hour: i, type: 'alta', height: curr })
      }
      if (curr <= prev && curr <= next && curr < midLevel - amplitude * 0.15) {
        if (!last || last.type !== 'baixa' || i - last.hour > 1) tideEvents.push({ hour: i, type: 'baixa', height: curr })
      }
    }

    const viewWidth = 340, viewHeight = 150
    const padding = { top: 30, bottom: 20, left: 8, right: 8 }
    const chartWidth = viewWidth - padding.left - padding.right
    const chartHeight = viewHeight - padding.top - padding.bottom
    const minH = midLevel - amplitude - 0.08
    const maxH = midLevel + amplitude + 0.08
    const xScale = (h: number) => (h / 24) * chartWidth + padding.left
    const yScale = (h: number) => chartHeight - ((h - minH) / (maxH - minH)) * chartHeight + padding.top
    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.hour).toFixed(1)} ${yScale(p.height).toFixed(1)}`).join(' ')
    const areaData = pathData + ` L ${xScale(24).toFixed(1)} ${(chartHeight + padding.top).toFixed(1)} L ${xScale(0).toFixed(1)} ${(chartHeight + padding.top).toFixed(1)} Z`
    return { viewWidth, viewHeight, padding, chartHeight, xScale, yScale, pathData, areaData, tideEvents }
  }, [heights])

  if (heights.length < 20) return null

  const formatHour = (h: number) =>
    `${Math.floor(h).toString().padStart(2, '0')}:${Math.round((h - Math.floor(h)) * 60).toString().padStart(2, '0')}`

  return (
    <div className="relative rounded-xl overflow-hidden bg-muted/10 border border-border/30 p-1">
      <svg width="100%" viewBox={`0 0 ${chart.viewWidth} ${chart.viewHeight}`} className="overflow-visible">
        <defs>
          <linearGradient id="dayTideGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <path d={chart.areaData} fill="url(#dayTideGrad)" />
        <path d={chart.pathData} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {chart.tideEvents.map((event, i) => {
          const ex = chart.xScale(event.hour), ey = chart.yScale(event.height), isHigh = event.type === 'alta'
          const labelX = Math.min(Math.max(ex, chart.padding.left + 22), chart.viewWidth - chart.padding.right - 22)
          return (
            <g key={i}>
              <circle cx={ex} cy={ey} r="3.5" fill={isHigh ? 'var(--color-rating-good)' : 'var(--color-rating-fair)'} />
              <text x={labelX} y={isHigh ? ey - 20 : ey + 22} textAnchor="middle" fontSize="8.5" fill={isHigh ? 'var(--color-rating-good)' : 'var(--color-rating-fair)'} fontWeight="600">
                {isHigh ? 'Alta' : 'Baixa'} {formatHour(event.hour)}
              </text>
            </g>
          )
        })}
        {[0, 6, 12, 18, 24].map(h => (
          <text key={h} x={chart.xScale(h)} y={chart.viewHeight - 4} textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.5">
            {h === 24 ? '00h' : `${h}h`}
          </text>
        ))}
      </svg>
    </div>
  )
}
