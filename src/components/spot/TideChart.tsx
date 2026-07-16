import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { Maximize2, X } from 'lucide-react'
import { getRealTide } from '@/lib/weatherData'

const generateTideData = (realLevels?: number[]) => {
  const now = new Date()
  const points: { hour: number, height: number }[] = []
  let phaseOffset = 0
  if (realLevels && realLevels.length >= 24) {
    for (let h = 0; h <= 24; h += 0.25) {
      const i = Math.min(23, Math.floor(h)), frac = h - Math.floor(h)
      const h0 = realLevels[i]??0, h1 = realLevels[Math.min(23,i+1)]??h0
      points.push({ hour: h, height: Number((h0+(h1-h0)*frac).toFixed(2)) })
    }
  } else {
    const amplitude=0.20,midLevel=0.5,period=12.4
    const dayOfYear=Math.floor((now.getTime()-new Date(now.getFullYear(),0,0).getTime())/86400000)
    phaseOffset=(dayOfYear*0.8)%period
    for (let h=0;h<=24;h+=0.25) points.push({ hour:h, height:Number((midLevel+amplitude*Math.cos((2*Math.PI*(h+phaseOffset))/period)).toFixed(2)) })
  }
  const allH=points.map(p=>p.height), midLevel=(Math.max(...allH)+Math.min(...allH))/2, amplitude=(Math.max(...allH)-Math.min(...allH))/2
  const tideEvents: {hour:number,type:'alta'|'baixa',height:number}[]=[]
  for (let i=1;i<points.length-1;i++) {
    const prev=points[i-1].height,curr=points[i].height,next=points[i+1].height
    if (curr>prev&&curr>next&&curr>midLevel+amplitude*0.5) tideEvents.push({hour:points[i].hour,type:'alta',height:curr})
    if (curr<prev&&curr<next&&curr<midLevel-amplitude*0.5) tideEvents.push({hour:points[i].hour,type:'baixa',height:curr})
  }
  const currentHour=now.getHours()+now.getMinutes()/60, ci=Math.min(23,Math.floor(currentHour)), frac=currentHour-ci
  const currentHeight=realLevels&&realLevels.length>=24
    ?Number(((realLevels[ci]??0)+((realLevels[Math.min(23,ci+1)]??0)-(realLevels[ci]??0))*frac).toFixed(2))
    :points.find(p=>Math.abs(p.hour-currentHour)<0.13)?.height??midLevel
  return { points, amplitude, midLevel, phaseOffset, period:12.4, tideEvents, currentHeight:Number(currentHeight.toFixed(2)) }
}

type TooltipState = { x: number; y: number; hour: number; height: number } | null

import { Separator } from '@/components/ui/separator'

const TideChartSVG = memo(({ tide, expanded=false, realLevels }: { tide:string, expanded?:boolean, realLevels?:number[] }) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const chart = useMemo(() => {
    const { points, midLevel, amplitude, phaseOffset, period, tideEvents, currentHeight } = generateTideData(realLevels)
    const currentHour = now.getHours() + now.getMinutes() / 60
    const viewWidth = expanded ? 560 : 340
    const viewHeight = expanded ? 220 : 160
    const padding = { top: 40, bottom: 36, left: 32, right: 12 }
    const chartWidth = viewWidth - padding.left - padding.right
    const chartHeight = viewHeight - padding.top - padding.bottom
    const minH = midLevel - amplitude - 0.08
    const maxH = midLevel + amplitude + 0.08
    const xScale = (h: number) => (h / 24) * chartWidth + padding.left
    const yScale = (h: number) => chartHeight - ((h - minH) / (maxH - minH)) * chartHeight + padding.top
    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.hour).toFixed(1)} ${yScale(p.height).toFixed(1)}`).join(' ')
    const areaData = pathData + ` L ${xScale(24).toFixed(1)} ${(chartHeight + padding.top).toFixed(1)} L ${xScale(0).toFixed(1)} ${(chartHeight + padding.top).toFixed(1)} Z`
    return {
      points, midLevel, amplitude, phaseOffset, period, tideEvents, currentHeight,
      currentHour, viewWidth, viewHeight, padding, chartWidth, chartHeight,
      xScale, yScale, pathData, areaData,
      currentX: xScale(currentHour), currentY: yScale(currentHeight),
    }
  }, [realLevels, expanded, now])

  const formatHour = useCallback((h: number) =>
    `${Math.floor(h).toString().padStart(2,'0')}:${Math.round((h - Math.floor(h)) * 60).toString().padStart(2,'0')}`, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const rawX = (e.clientX - rect.left) * (chart.viewWidth / rect.width)
    const hour = Math.max(0, Math.min(24, (rawX - chart.padding.left) / chart.chartWidth * 24))
    let height: number
    if (realLevels && realLevels.length >= 24) {
      const i = Math.min(23, Math.floor(hour)), frac = hour - Math.floor(hour)
      height = (realLevels[i] ?? 0) + ((realLevels[Math.min(23, i+1)] ?? 0) - (realLevels[i] ?? 0)) * frac
    } else {
      height = chart.midLevel + chart.amplitude * Math.cos((2 * Math.PI * (hour + chart.phaseOffset)) / chart.period)
    }
    setTooltip({ x: rawX, y: chart.yScale(Number(height.toFixed(2))), hour, height: Number(height.toFixed(2)) })
  }, [chart, realLevels])

  const gradId = expanded ? 'tideGradExp' : 'tideGrad'
  const tooltipBoxW = 72, tooltipBoxH = 36
  const tooltipX = tooltip ? Math.min(Math.max(tooltip.x - tooltipBoxW/2, chart.padding.left), chart.viewWidth - chart.padding.right - tooltipBoxW) : 0
  const tooltipY = tooltip ? Math.max(chart.padding.top + 2, tooltip.y - tooltipBoxH - 10) : 0

  const { viewWidth, viewHeight, padding, chartWidth, chartHeight, xScale, yScale,
          tideEvents, currentHeight, currentX, currentY, currentHour: _ch } = chart

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div><div className="text-xs text-muted-foreground">Estado Atual</div><div className="text-xl font-bold">{tide}</div></div>
        <Separator orientation="vertical" className="h-10"/>
        <div><div className="text-xs text-muted-foreground">Nível Agora</div><div className="text-xl font-bold text-primary">~{currentHeight}m</div></div>
        {!realLevels && (
          <span className="ml-auto text-[10px] text-muted-foreground/70 italic">estimativa</span>
        )}
      </div>
      <div className="relative rounded-xl overflow-hidden bg-muted/10 border border-border/30 p-1">
        <svg ref={svgRef} width="100%" viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="overflow-visible cursor-crosshair" onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
          <defs><linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.5"/><stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.03"/></linearGradient></defs>
          <path d={chart.areaData} fill={`url(#${gradId})`}/>
          <path d={chart.pathData} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          {tideEvents.map((event, i) => {
            const ex=xScale(event.hour), ey=yScale(event.height), isHigh=event.type==='alta'
            const labelX=Math.min(Math.max(ex, padding.left+24), viewWidth-padding.right-24)
            return <g key={i}><circle cx={ex} cy={ey} r="3.5" fill={isHigh?'var(--color-rating-good)':'var(--color-rating-fair)'}/><text x={labelX} y={isHigh?ey-20:ey+24} textAnchor="middle" fontSize="8.5" fill={isHigh?'var(--color-rating-good)':'var(--color-rating-fair)'} fontWeight="600">{formatHour(event.hour)}</text></g>
          })}
          {[0,6,12,18,24].map(h => <g key={h}><text x={xScale(h)} y={viewHeight-4} textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.5">{h===24?'00h':`${h}h`}</text></g>)}
          <line x1={currentX} y1={padding.top} x2={currentX} y2={chartHeight+padding.top} stroke="currentColor" strokeWidth="1" strokeDasharray="3,2" opacity="0.4"/>
          <rect x={Math.min(currentX-16, viewWidth-padding.right-32)} y={padding.top-14} width="32" height="13" rx="3" fill="var(--color-primary)" opacity="0.9"/>
          <text x={Math.min(currentX, viewWidth-padding.right-16)} y={padding.top-4} textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">Agora</text>
          <circle cx={currentX} cy={currentY} r="5" fill="var(--color-primary)" stroke="white" strokeWidth="2"/>
          {tooltip && (<>
            <line x1={tooltip.x} y1={padding.top} x2={tooltip.x} y2={chartHeight+padding.top} stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" opacity="0.4"/>
            <circle cx={tooltip.x} cy={tooltip.y} r="4" fill="white" stroke="var(--color-primary)" strokeWidth="2"/>
            <rect x={tooltipX} y={tooltipY} width={tooltipBoxW} height={tooltipBoxH} rx="5" fill="var(--color-card)" stroke="var(--color-primary)" strokeWidth="1" opacity="0.95"/>
            <text x={tooltipX+tooltipBoxW/2} y={tooltipY+13} textAnchor="middle" fontSize="9" fill="var(--color-primary)" fontWeight="bold">{formatHour(tooltip.hour)}</text>
            <text x={tooltipX+tooltipBoxW/2} y={tooltipY+27} textAnchor="middle" fontSize="11" fill="var(--color-foreground)" fontWeight="bold">{tooltip.height.toFixed(2)}m</text>
          </>)}
        </svg>
      </div>
    </div>
  )
})

export const TideChart = ({ tide }: { tide: string }) => {
  const [expanded, setExpanded] = useState(false)
  const [realLevels, setRealLevels] = useState<number[]|undefined>(undefined)
  const [realState, setRealState] = useState<string>(tide)
  useEffect(() => { getRealTide().then(data=>{ if(data){setRealLevels(data.hourlyLevels);setRealState(data.state)} }) }, [])
  return (
    <>
      <div className="relative">
        <TideChartSVG tide={realState} realLevels={realLevels}/>
        <button onClick={()=>setExpanded(true)} className="absolute top-0 right-0 p-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors"><Maximize2 className="h-4 w-4 text-muted-foreground"/></button>
      </div>
      {expanded&&(
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setExpanded(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Como vai estar o mar hoje?</h3>
              <button onClick={()=>setExpanded(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="h-5 w-5 text-muted-foreground"/></button>
            </div>
            <TideChartSVG tide={realState} expanded={true} realLevels={realLevels}/>
          </div>
        </div>
      )}
    </>
  )
}
