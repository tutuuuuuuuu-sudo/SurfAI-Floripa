import { useState, useEffect, useMemo } from 'react'
import { getRealTide } from '@/lib/weatherData'
import { nowHourSP } from '@/lib/timeSP'
import { DayTideChart } from '@/components/spot/DayTideChart'

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

// Gráfico de maré da aba "Agora" de SpotDetails. Desde 25/set/2026 usa o mesmo DayTideChart
// arrastável da previsão de um dia (pedido do usuário: mesmo estilo da curva da Melhor
// Janela, passando o dedo e vendo cada horário) — no lugar do SVG antigo com tooltip de
// mouse (não funcionava no celular) e do modal de ampliar (sem necessidade com o arraste).
export const TideChart = ({ tide }: { tide: string }) => {
  const [realLevels, setRealLevels] = useState<number[] | undefined>(undefined)
  useEffect(() => { getRealTide().then(data => { if (data) setRealLevels(data.hourlyLevels) }) }, [])

  // Sem dado real, usa a estimativa harmônica de generateTideData (só as horas cheias)
  const heights = useMemo(() => {
    if (realLevels && realLevels.length >= 24) return realLevels.slice(0, 25)
    const { points } = generateTideData()
    return points.filter(p => Number.isInteger(p.hour)).map(p => p.height)
  }, [realLevels])

  return (
    <div className="space-y-1">
      <DayTideChart heights={heights} nowHour={nowHourSP()} />
      {!realLevels && (
        <p className="text-[10px] text-muted-foreground/70 italic text-right">estimativa · estado atual: {tide.toLowerCase()}</p>
      )}
    </div>
  )
}
