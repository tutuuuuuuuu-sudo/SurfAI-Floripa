import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { fetchCurrentConditions, analyzeConditions, BeachCondition, SubRegion } from '@/lib/surfData'
import { getWeatherForecast, WeatherForecast, getRealTide } from '@/lib/weatherData'
import { isFavorite, toggleFavorite } from '@/lib/favorites'
import { getComments, addComment, deleteComment, formatCommentTime, Comment } from '@/lib/comments'
import { supabase } from '@/lib/supabase'
import { usePremium } from '@/lib/premium'
import {
  ArrowLeft, Waves, Wind, Navigation,
  TrendingUp, Compass, AlertCircle, Thermometer, MapPin,
  Heart, Calendar, Star, Sun, Maximize2, X,
  Share2, MessageCircle, Trash2, Send, ChevronDown, ChevronUp,
  Lock, Crown, Clock, Droplets, ChevronRight
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from 'sonner'
import { getRatingInfo } from '@/lib/rating'

const FIXED_DOMAIN = typeof window !== 'undefined' ? window.location.origin : ''
const metersToFeet = (m: number): string => `${(m * 3.281).toFixed(1)}ft`

const directionNames: Record<string, string> = {
  'N': 'Norte', 'NNE': 'Nordeste', 'NE': 'Nordeste', 'ENE': 'Nordeste',
  'E': 'Leste', 'ESE': 'Sudeste', 'SE': 'Sudeste', 'SSE': 'Sudeste',
  'S': 'Sul', 'SSW': 'Sudoeste', 'SW': 'Sudoeste', 'WSW': 'Sudoeste',
  'W': 'Oeste', 'WNW': 'Noroeste', 'NW': 'Noroeste', 'NNW': 'Noroeste'
}

const getWindDirectionCode = (d: string) => d.split(' ')[0]
const formatWindDirection = (d: string) => ({ code: getWindDirectionCode(d), name: directionNames[getWindDirectionCode(d)] ?? getWindDirectionCode(d) })
const directionToDegrees = (d: string): number => {
  const map: Record<string, number> = {
    'N':0,'NNE':22.5,'NE':45,'ENE':67.5,'E':90,'ESE':112.5,'SE':135,'SSE':157.5,
    'S':180,'SSW':202.5,'SW':225,'WSW':247.5,'W':270,'WNW':292.5,'NW':315,'NNW':337.5
  }
  return map[getWindDirectionCode(d)] ?? 0
}

const WindCompass = ({ direction, speed }: { direction: string, speed: number }) => {
  const degrees = directionToDegrees(direction)
  const { code, name } = formatWindDirection(direction)
  const color = speed <= 10 ? '#22c55e' : speed <= 20 ? '#f59e0b' : speed <= 30 ? '#f97316' : '#ef4444'
  const allDirs = [0,22.5,45,67.5,90,112.5,135,157.5,180,202.5,225,247.5,270,292.5,315,337.5]
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="120" height="120" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="62" fill="none" stroke={color} strokeWidth="0.8" strokeDasharray="2,4" opacity="0.18"/>
        <circle cx="70" cy="70" r="46" fill="none" stroke="currentColor" strokeWidth="0.6" className="text-muted-foreground" opacity="0.14"/>
        <circle cx="70" cy="70" r="28" fill="none" stroke="currentColor" strokeWidth="0.6" className="text-muted-foreground" opacity="0.10"/>
        <line x1="8" y1="70" x2="132" y2="70" stroke="currentColor" strokeWidth="0.3" className="text-muted-foreground" opacity="0.10"/>
        <line x1="70" y1="8" x2="70" y2="132" stroke="currentColor" strokeWidth="0.3" className="text-muted-foreground" opacity="0.10"/>
        {allDirs.map(deg => {
          const rad = (deg-90)*Math.PI/180
          const isCardinal = deg%90===0, isMain = deg%45===0
          const inner = isCardinal?50:isMain?52:55, outer = isCardinal?62:isMain?61:60
          return <line key={deg} x1={70+inner*Math.cos(rad)} y1={70+inner*Math.sin(rad)} x2={70+outer*Math.cos(rad)} y2={70+outer*Math.sin(rad)} stroke="currentColor" strokeWidth={isCardinal?1.5:isMain?1:0.7} className="text-muted-foreground" opacity={isCardinal?0.45:isMain?0.3:0.18}/>
        })}
        <text x="70" y="7" textAnchor="middle" fontSize="10" fontWeight="bold" fill={color}>N</text>
        <text x="70" y="136" textAnchor="middle" fontSize="9" fill="currentColor" className="text-muted-foreground" opacity="0.4">S</text>
        <text x="135" y="73" textAnchor="middle" fontSize="9" fill="currentColor" className="text-muted-foreground" opacity="0.4">L</text>
        <text x="5" y="73" textAnchor="middle" fontSize="9" fill="currentColor" className="text-muted-foreground" opacity="0.4">O</text>
        <g transform={`rotate(${degrees},70,70)`}>
          <line x1="70" y1="70" x2="70" y2="26" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
          <polygon points="70,15 64,28 76,28" fill={color}/>
          <line x1="70" y1="70" x2="70" y2="88" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.30"/>
        </g>
        <circle cx="70" cy="70" r="5.5" fill={color}/>
        <circle cx="70" cy="70" r="2.5" fill="white"/>
      </svg>
      <div className="text-center">
        <div className="text-base font-bold" style={{ color }}>{speed}km/h</div>
        <div className="text-xs text-muted-foreground">{code} — {name}</div>
      </div>
    </div>
  )
}

const generateTideData = (realLevels?: number[]) => {
  const now = new Date()
  const points: { hour: number, height: number }[] = []
  if (realLevels && realLevels.length >= 24) {
    for (let h = 0; h <= 24; h += 0.25) {
      const i = Math.min(23, Math.floor(h)), frac = h - Math.floor(h)
      const h0 = realLevels[i]??0, h1 = realLevels[Math.min(23,i+1)]??h0
      points.push({ hour: h, height: Number((h0+(h1-h0)*frac).toFixed(2)) })
    }
  } else {
    const amplitude=0.20,midLevel=0.5,period=12.4
    const dayOfYear=Math.floor((now.getTime()-new Date(now.getFullYear(),0,0).getTime())/86400000)
    const phaseOffset=(dayOfYear*0.8)%period
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
  return { points, amplitude, midLevel, phaseOffset:0, period:12.4, tideEvents, currentHeight:Number(currentHeight.toFixed(2)) }
}

const TideChartSVG = ({ tide, expanded=false, realLevels }: { tide:string, expanded?:boolean, realLevels?:number[] }) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{x:number,y:number,hour:number,height:number}|null>(null)
  const { points, midLevel, amplitude, phaseOffset, period, tideEvents, currentHeight } = generateTideData(realLevels)
  const now = new Date(), currentHour = now.getHours()+now.getMinutes()/60
  const viewWidth=expanded?560:340, viewHeight=expanded?220:160
  const padding={top:40,bottom:36,left:32,right:12}
  const chartWidth=viewWidth-padding.left-padding.right, chartHeight=viewHeight-padding.top-padding.bottom
  const minH=midLevel-amplitude-0.08, maxH=midLevel+amplitude+0.08
  const xScale=(h:number)=>(h/24)*chartWidth+padding.left
  const yScale=(h:number)=>chartHeight-((h-minH)/(maxH-minH))*chartHeight+padding.top
  const pathData=points.map((p,i)=>`${i===0?'M':'L'} ${xScale(p.hour).toFixed(1)} ${yScale(p.height).toFixed(1)}`).join(' ')
  const areaData=pathData+` L ${xScale(24).toFixed(1)} ${(chartHeight+padding.top).toFixed(1)} L ${xScale(0).toFixed(1)} ${(chartHeight+padding.top).toFixed(1)} Z`
  const currentX=xScale(currentHour), currentY=yScale(currentHeight)
  const formatHour=(h:number)=>`${Math.floor(h).toString().padStart(2,'0')}:${Math.round((h-Math.floor(h))*60).toString().padStart(2,'0')}`
  const handleMouseMove=(e:React.MouseEvent<SVGSVGElement>)=>{
    if (!svgRef.current) return
    const rect=svgRef.current.getBoundingClientRect()
    const rawX=(e.clientX-rect.left)*(viewWidth/rect.width)
    const hour=Math.max(0,Math.min(24,(rawX-padding.left)/chartWidth*24))
    let height:number
    if (realLevels&&realLevels.length>=24) {
      const i=Math.min(23,Math.floor(hour)),frac=hour-Math.floor(hour)
      height=(realLevels[i]??0)+((realLevels[Math.min(23,i+1)]??0)-(realLevels[i]??0))*frac
    } else {
      height=midLevel+amplitude*Math.cos((2*Math.PI*(hour+phaseOffset))/period)
    }
    setTooltip({x:rawX,y:yScale(Number(height.toFixed(2))),hour,height:Number(height.toFixed(2))})
  }
  const gradId=expanded?'tideGradExp':'tideGrad'
  const tooltipBoxW=72,tooltipBoxH=36
  const tooltipX=tooltip?Math.min(Math.max(tooltip.x-tooltipBoxW/2,padding.left),viewWidth-padding.right-tooltipBoxW):0
  const tooltipY=tooltip?Math.max(padding.top+2,tooltip.y-tooltipBoxH-10):0
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div><div className="text-xs text-muted-foreground">Estado Atual</div><div className="text-xl font-bold">{tide}</div></div>
        <Separator orientation="vertical" className="h-10"/>
        <div><div className="text-xs text-muted-foreground">Nível Agora</div><div className="text-xl font-bold text-cyan-500">~{currentHeight}m</div></div>
      </div>
      <div className="relative rounded-xl overflow-hidden bg-muted/10 border border-border/30 p-1">
        <svg ref={svgRef} width="100%" viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="overflow-visible cursor-crosshair" onMouseMove={handleMouseMove} onMouseLeave={()=>setTooltip(null)}>
          <defs><linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06b6d4" stopOpacity="0.5"/><stop offset="100%" stopColor="#06b6d4" stopOpacity="0.03"/></linearGradient></defs>
          <path d={areaData} fill={`url(#${gradId})`}/>
          <path d={pathData} fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          {tideEvents.map((event,i)=>{
            const ex=xScale(event.hour),ey=yScale(event.height),isHigh=event.type==='alta'
            const labelX=Math.min(Math.max(ex,padding.left+24),viewWidth-padding.right-24)
            return <g key={i}><circle cx={ex} cy={ey} r="3.5" fill={isHigh?'#22c55e':'#f59e0b'}/><text x={labelX} y={isHigh?ey-20:ey+24} textAnchor="middle" fontSize="8.5" fill={isHigh?'#22c55e':'#f59e0b'} fontWeight="600">{formatHour(event.hour)}</text></g>
          })}
          {[0,6,12,18,24].map(h=><g key={h}><text x={xScale(h)} y={viewHeight-4} textAnchor="middle" fontSize="8" fill="#6b7280">{h===24?'00h':`${h}h`}</text></g>)}
          <line x1={currentX} y1={padding.top} x2={currentX} y2={chartHeight+padding.top} stroke="#ffffff" strokeWidth="1" strokeDasharray="3,2" opacity="0.4"/>
          <rect x={Math.min(currentX-16,viewWidth-padding.right-32)} y={padding.top-14} width="32" height="13" rx="3" fill="#06b6d4" opacity="0.9"/>
          <text x={Math.min(currentX,viewWidth-padding.right-16)} y={padding.top-4} textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">Agora</text>
          <circle cx={currentX} cy={currentY} r="5" fill="#06b6d4" stroke="white" strokeWidth="2"/>
          {tooltip&&(<>
            <line x1={tooltip.x} y1={padding.top} x2={tooltip.x} y2={chartHeight+padding.top} stroke="#ffffff" strokeWidth="1" strokeDasharray="2,2" opacity="0.4"/>
            <circle cx={tooltip.x} cy={tooltip.y} r="4" fill="white" stroke="#06b6d4" strokeWidth="2"/>
            <rect x={tooltipX} y={tooltipY} width={tooltipBoxW} height={tooltipBoxH} rx="5" fill="#0e1117" stroke="#06b6d4" strokeWidth="1" opacity="0.95"/>
            <text x={tooltipX+tooltipBoxW/2} y={tooltipY+13} textAnchor="middle" fontSize="9" fill="#06b6d4" fontWeight="bold">{formatHour(tooltip.hour)}</text>
            <text x={tooltipX+tooltipBoxW/2} y={tooltipY+27} textAnchor="middle" fontSize="11" fill="white" fontWeight="bold">{tooltip.height.toFixed(2)}m</text>
          </>)}
        </svg>
      </div>
    </div>
  )
}

const TideChart = ({ tide }: { tide: string }) => {
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

const AnimatedProgress = ({ value }: { value: number }) => {
  const [displayed, setDisplayed] = useState(0)
  useEffect(()=>{ const t=setTimeout(()=>setDisplayed(value),100); return ()=>clearTimeout(t) },[value])
  return <Progress value={displayed} className="h-1.5 transition-all duration-1000 ease-out"/>
}

const SwellPeriodBadge = ({ period }: { period: number }) => {
  const [open, setOpen] = useState(false)
  const getInfo=(p:number)=>{
    if(p>=14) return {label:'Épico',color:'#8b5cf6',desc:'Swell de longo período — ondas perfeitas e muito potentes.'}
    if(p>=12) return {label:'Muito Bom',color:'#06b6d4',desc:'Excelente ondulação — ondas longas, limpas e com energia.'}
    if(p>=10) return {label:'Bom',color:'#22c55e',desc:'Boa ondulação — ondas bem formadas e surfáveis.'}
    if(p>=8) return {label:'Regular',color:'#f59e0b',desc:'Ondulação moderada — surfável mas sem muita qualidade.'}
    return {label:'Fraco',color:'#ef4444',desc:'Vento local — ondas curtas e bagunçadas.'}
  }
  const info=getInfo(period)
  return (
    <div>
      <button onClick={()=>setOpen(!open)} className="flex items-center gap-1.5">
        <div className="text-lg font-semibold">{Math.round(period)}s</div>
        <span className="text-xs px-1.5 py-0.5 rounded-full font-bold text-white" style={{backgroundColor:info.color}}>{info.label}</span>
        {open?<ChevronUp className="h-3 w-3 text-muted-foreground"/>:<ChevronDown className="h-3 w-3 text-muted-foreground"/>}
      </button>
      {open&&<div className="mt-2 text-xs text-muted-foreground bg-muted/20 rounded-lg p-2 border" style={{borderColor:info.color+'40'}}>{info.desc}</div>}
    </div>
  )
}

const CommentsSection = ({ spot }: { spot: BeachCondition }) => {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string|null>(null)
  useEffect(()=>{ loadComments(); supabase.auth.getUser().then(({data})=>setCurrentUserId(data.user?.id??null)) },[spot.id])
  const loadComments=async()=>{ setLoading(true); setComments(await getComments(spot.id)); setLoading(false) }
  const handleSubmit=async()=>{
    if(!newComment.trim()||!currentUserId) return
    setSubmitting(true)
    const success=await addComment(spot.id,spot.name,newComment.trim(),spot.waveHeight,spot.score)
    if(success){setNewComment('');toast.success('Comentário adicionado!');await loadComments()}
    else toast.error('Erro ao adicionar comentário.')
    setSubmitting(false)
  }
  const handleDelete=async(commentId:string)=>{
    if(await deleteComment(commentId)){setComments(prev=>prev.filter(c=>c.id!==commentId));toast.success('Comentário removido.')}
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <MessageCircle className="h-5 w-5 text-primary"/>
        <span className="font-semibold text-base">Relatos do Dia</span>
        {comments.length>0&&<Badge variant="secondary" className="text-xs">{comments.length}</Badge>}
      </div>
      {currentUserId?(
        <div className="flex gap-2">
          <input value={newComment} onChange={e=>setNewComment(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&handleSubmit()} placeholder="Como está o mar agora?" className="flex-1 text-sm px-3 py-2.5 rounded-xl border border-border bg-muted/20 outline-none focus:border-primary transition-colors" maxLength={280}/>
          <button onClick={handleSubmit} disabled={submitting||!newComment.trim()} className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"><Send className="h-4 w-4"/></button>
        </div>
      ):(
        <div className="text-xs text-muted-foreground bg-muted/20 rounded-xl p-3 text-center">Faça login para deixar um relato</div>
      )}
      {loading?<div className="flex justify-center py-4"><Waves className="h-5 w-5 text-primary animate-bounce"/></div>
      :comments.length===0?(
        <div className="text-center py-6 text-muted-foreground"><MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-20"/><p className="text-xs">Nenhum relato ainda. Seja o primeiro!</p></div>
      ):(
        <div className="space-y-3">
          {comments.map((comment,idx)=>(
            <div key={comment.id} className="flex gap-3 p-3 bg-muted/20 rounded-xl" style={{animation:`slideInLeft 0.3s ${idx*0.05}s ease-out both`}}>
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0"><span className="text-xs font-bold text-primary">{comment.user_name.charAt(0).toUpperCase()}</span></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold">{comment.user_name}</span>
                  {comment.wave_height&&<span className="text-xs text-muted-foreground">· {Number(comment.wave_height).toFixed(1)}m</span>}
                  <span className="text-xs text-muted-foreground ml-auto">{formatCommentTime(comment.created_at)}</span>
                </div>
                <p className="text-sm break-words">{comment.content}</p>
              </div>
              {currentUserId===comment.user_id&&<button onClick={()=>handleDelete(comment.id)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"><Trash2 className="h-3.5 w-3.5"/></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const ShareButton = ({ spot }: { spot: BeachCondition }) => {
  const handleShare=async()=>{
    const rating=getRatingInfo(spot.score)
    const spotUrl=`${FIXED_DOMAIN}/spot/${spot.id}`
    const text=`🏄 ${spot.name} está ${rating.label} agora!\n\nScore: ${spot.score.toFixed(1)}/10\nOndas: ${spot.waveHeight.toFixed(1)}m · Período: ${Math.round(spot.swellPeriod)}s\nVento: ${Math.round(spot.windSpeed)}km/h · Água: ${spot.waterConditions.temperature}°C\n\nVeja mais: ${spotUrl}`
    if(navigator.share){try{await navigator.share({title:`Surf AI — ${spot.name}`,text,url:spotUrl});return}catch(_){}}
    await navigator.clipboard.writeText(text)
    toast.success('Condições copiadas! Cole no WhatsApp 📋')
  }
  return (
    <button onClick={handleShare} className="p-2 rounded-xl border border-border hover:bg-muted/50 transition-colors">
      <Share2 className="h-4 w-4"/>
    </button>
  )
}


// ── Score Explainer Modal ───────────────────────────────────────────────────
const ScoreExplainer = ({ spot, onClose }: { spot: BeachCondition, onClose: () => void }) => {
  const rating = getRatingInfo(spot.score)
  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Como calculamos o score</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="h-5 w-5 text-muted-foreground"/></button>
        </div>
        <div className={`text-6xl font-bold text-center mb-1 ${rating.color}`}>{spot.score.toFixed(1)}</div>
        <div className={`text-center text-sm font-bold mb-6 ${rating.color}`}>{rating.label}</div>
        <div className="space-y-4">
          {[
            {label:'Ondulação',max:10,value:spot.waveHeight>=2.5?10:spot.waveHeight>=2.0?9.5:spot.waveHeight>=1.5?9.0:spot.waveHeight>=1.2?8.5:spot.waveHeight>=1.0?8.0:spot.waveHeight>=0.8?7.5:spot.waveHeight>=0.6?7.0:spot.waveHeight>=0.5?6.5:5.0,desc:`${spot.waveHeight.toFixed(1)}m`,icon:'🌊'},
            {label:'Período',max:10,value:spot.swellPeriod>=14?9:spot.swellPeriod>=12?8:spot.swellPeriod>=10?7:spot.swellPeriod>=8?6:spot.swellPeriod>=7?5.5:5,desc:`${Math.round(spot.swellPeriod)}s entre ondas`,icon:'⏱️'},
            {label:'Vento',max:10,value:spot.windSpeed<=10?9:spot.windSpeed<=15?7.5:spot.windSpeed<=20?6:4,desc:`${Math.round(spot.windSpeed)}km/h ${spot.windDirection}`,icon:'💨'},
          ].map(item=>(
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-xl">{item.icon}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1"><span className="text-sm font-semibold">{item.label}</span><span className="text-sm font-bold text-primary">{item.value.toFixed(1)}/10</span></div>
                <div className="w-full bg-muted rounded-full h-1.5"><div className="bg-primary h-1.5 rounded-full transition-all duration-700" style={{width:`${Math.min(100,(item.value/item.max)*100)}%`}}/></div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-5 text-center">Score calculado com base em ondulação, período, vento e orientação da praia</p>
      </div>
    </div>
  )
}

// ── Forecast Day Card ───────────────────────────────────────────────────────
const ForecastCard = ({
  day, index, isPremium, usesFeet, freeDays, onUpgrade
}: {
  day: WeatherForecast
  index: number
  isPremium: boolean
  usesFeet: boolean
  freeDays: number
  onUpgrade: () => void
}) => {
  const isLocked = index >= freeDays && !isPremium
  const isToday = index === 0
  const rating = getRatingInfo(day.score)

  if (isLocked) {
    return (
      <button
        onClick={onUpgrade}
        className="flex flex-col items-center justify-center gap-1 p-3 rounded-2xl border border-dashed border-border/40 bg-muted/10 hover:bg-muted/20 transition-all min-h-[120px]"
        style={{animation:`fadeIn 0.4s ${index*0.05}s ease-out both`}}
      >
        <Lock className="h-4 w-4 text-muted-foreground/50 mb-1"/>
        <div className="text-xs font-bold text-muted-foreground">{day.dayName}</div>
        <Crown className="h-3.5 w-3.5 text-yellow-500/60"/>
      </button>
    )
  }

  return (
    <div
      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${
        isToday
          ? 'bg-primary/8 border-primary/30 shadow-sm'
          : 'bg-card border-border/40 hover:border-primary/20'
      }`}
      style={{animation:`fadeIn 0.4s ${index*0.05}s ease-out both`}}
    >
      <div className="text-center">
        <div className={`text-xs font-bold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
          {isToday ? 'Hoje' : day.dayName}
        </div>
        <div className="text-xs text-muted-foreground/60">
          {new Date(day.date+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}
        </div>
      </div>

      <div className={`text-2xl font-bold ${rating.color}`}>{Number(day.score).toFixed(1)}</div>
      <div className={`text-xs font-semibold ${rating.color}`}>{rating.label}</div>

      <div className="flex gap-0.5">{[1,2,3,4,5].map(i=><div key={i} className={`h-1 w-3.5 rounded-full ${i<=rating.bars?rating.bg:'bg-muted'}`}/>)}</div>

      <Separator className="w-full opacity-30"/>

      <div className="w-full space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-muted-foreground"><Waves className="h-3 w-3"/></div>
          <span className="text-xs font-semibold">{usesFeet?metersToFeet(day.waveHeight):`${Number(day.waveHeight).toFixed(1)}m`}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-muted-foreground"><Wind className="h-3 w-3"/></div>
          <span className="text-xs font-semibold">{Math.round(day.windSpeed)}km/h</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-muted-foreground"><Thermometer className="h-3 w-3"/></div>
          <span className="text-xs font-semibold">{day.temperature}°C</span>
        </div>
      </div>
    </div>
  )
}

// ── Picos da Praia ──────────────────────────────────────────────────────────
const PicosSection = ({ spot }: { spot: BeachCondition }) => {
  const [selectedId, setSelectedId] = useState<string|null>(null)

  if (!spot.subRegions || spot.subRegions.length === 0) return null

  const swellDirOrder = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  const currentSwellIdx = swellDirOrder.indexOf(spot.swellDirection)

  const enrichedPicos = spot.subRegions.map(sub => {
    const idealDirs: string[] = sub.swellDirections ?? []
    let minDiff = 8
    idealDirs.forEach(dir => {
      const idx = swellDirOrder.indexOf(dir)
      if (idx >= 0 && currentSwellIdx >= 0) {
        let diff = Math.abs(currentSwellIdx - idx)
        if (diff > 8) diff = 16 - diff
        if (diff < minDiff) minDiff = diff
      }
    })
    const mult = minDiff===0?1.05:minDiff===1?1.00:minDiff===2?0.95:minDiff<=4?0.88:0.80
    const waveEst = spot.waveHeight * mult
    const waveMin = (waveEst * 0.95).toFixed(1)
    const waveMax = (waveEst * 1.05).toFixed(1)
    const match = minDiff===0?'Swell perfeito':minDiff<=2?'Swell bom':minDiff<=4?'Swell parcial':'Swell ruim'
    const matchColor = minDiff===0?'#22c55e':minDiff<=2?'#06b6d4':minDiff<=4?'#f59e0b':'#ef4444'
    return { ...sub, waveMin, waveMax, match, matchColor, idealDirs, minDiff }
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary"/>
        <span className="font-semibold text-sm">Picos da Praia</span>
        <span className="text-xs text-muted-foreground">— qual está melhor agora?</span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {enrichedPicos.map((pico, idx) => {
          const isSelected = selectedId === pico.id
          return (
            <div
              key={pico.id}
              className={`rounded-xl border transition-all cursor-pointer overflow-hidden ${
                pico.bestNow
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border/40 bg-card hover:bg-muted/20'
              }`}
              style={{animation:`slideInLeft 0.35s ${idx*0.07}s ease-out both`}}
              onClick={() => setSelectedId(isSelected ? null : pico.id)}
            >
              <div className="flex items-center gap-3 p-3">
                <div className="flex-shrink-0">
                  {pico.bestNow
                    ? <Star className="h-4 w-4 text-primary fill-primary"/>
                    : <div className="h-2 w-2 rounded-full bg-muted-foreground/40 mt-1"/>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{pico.name}</span>
                    {pico.bestNow && <Badge className="text-xs bg-primary text-primary-foreground px-2 py-0">Melhor agora</Badge>}
                  </div>
                  {pico.description && <p className="text-xs text-muted-foreground mt-0.5">{pico.description}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold">{pico.waveMin}–{pico.waveMax}m</div>
                  <div className="text-xs font-semibold" style={{color: pico.matchColor}}>{pico.match}</div>
                </div>
                <ChevronRight className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${isSelected ? 'rotate-90' : ''}`}/>
              </div>

              {isSelected && (
                <div className="px-3 pb-3 pt-1 border-t border-border/30" style={{animation:'slideUp 0.2s ease-out'}}>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="bg-background/60 rounded-xl p-2">
                      <div className="text-xs text-muted-foreground">Ondas</div>
                      <div className="text-sm font-bold text-primary">{pico.waveMin}–{pico.waveMax}m</div>
                    </div>
                    <div className="bg-background/60 rounded-xl p-2">
                      <div className="text-xs text-muted-foreground">Período</div>
                      <div className="text-sm font-bold">{Math.round(spot.swellPeriod)}s</div>
                    </div>
                    <div className="bg-background/60 rounded-xl p-2">
                      <div className="text-xs text-muted-foreground">Vento</div>
                      <div className="text-sm font-bold">{Math.round(spot.windSpeed)}km/h</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground bg-background/40 rounded-lg p-2 mb-2">
                    {pico.minDiff===0
                      ? `Swell de ${spot.swellDirection} é ideal para este pico.`
                      : pico.minDiff<=2
                      ? `Swell de ${spot.swellDirection} funciona bem. Ideal: ${pico.idealDirs.join(' ou ')}.`
                      : `Melhor com swell de ${pico.idealDirs.join(', ')}.`}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${pico.lat},${pico.lng}&travelmode=driving`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary/90 transition-colors"
                      onClick={e=>e.stopPropagation()}
                    >
                      <Navigation className="h-3.5 w-3.5"/>Google Maps
                    </a>
                    <a
                      href={`https://waze.com/ul?ll=${pico.lat},${pico.lng}&navigate=yes`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border border-border hover:bg-muted/50 transition-colors"
                      onClick={e=>e.stopPropagation()}
                    >
                      <Navigation className="h-3.5 w-3.5"/>Waze
                    </a>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function SpotDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [spot, setSpot] = useState<BeachCondition|null>(null)
  const [loadingSpot, setLoadingSpot] = useState(true)
  const [favorite, setFavorite] = useState(false)
  const [loadingFav, setLoadingFav] = useState(true)
  const [forecast, setForecast] = useState<WeatherForecast[]>([])
  const [visible, setVisible] = useState(false)
  const [showScoreExplainer, setShowScoreExplainer] = useState(false)
  const [activeTab, setActiveTab] = useState<'agora'|'previsao'>('agora')
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [usesFeet, setUsesFeet] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pref_units') ?? '"metric"') === 'imperial' } catch { return false }
  })
  const { isPremium } = usePremium()

  const FREE_DAYS = 3

  useEffect(() => {
    if (!id) return
    setLoadingSpot(true)
    setForecast([])
    setVisible(false)
    fetchCurrentConditions().then(async spots => {
      const found = spots.find(s => s.id === id) ?? null
      setSpot(found)
      setLoadingSpot(false)
      setTimeout(() => setVisible(true), 50)
      if (found) {
        getWeatherForecast(
          found.id,
          { waveHeight: found.waveHeight, windSpeed: found.windSpeed, swellPeriod: found.swellPeriod, windDirection: found.windDirection, waterTemperature: found.waterConditions.temperature, score: found.score },
          isPremium
        ).then(setForecast)
      }
    })
    isFavorite(id).then(val => { setFavorite(val); setLoadingFav(false) })
  }, [id, isPremium])

  if (loadingSpot) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <Waves className="h-12 w-12 mx-auto mb-4 text-primary animate-bounce"/>
        <p className="text-muted-foreground text-sm">Buscando condições em tempo real...</p>
      </div>
    </div>
  )
  if (!spot) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="max-w-md">
        <CardHeader><CardTitle>Praia não encontrada</CardTitle></CardHeader>
        <CardContent><Button onClick={() => navigate('/')}>Voltar para Home</Button></CardContent>
      </Card>
    </div>
  )

  const handleToggleFavorite = async () => {
    const newState = await toggleFavorite(spot.id, spot.name)
    setFavorite(newState)
    toast.success(newState ? '❤️ Adicionado aos favoritos!' : '💔 Removido dos favoritos')
  }

  const rating = getRatingInfo(spot.score)
  const windInfo = formatWindDirection(spot.windDirection)
  const airTemp = forecast.length > 0 ? forecast[0].temperature : null

  return (
    <div className="min-h-screen bg-background">
      {showScoreExplainer && <ScoreExplainer spot={spot} onClose={() => setShowScoreExplainer(false)}/>}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-2.5 max-w-4xl">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="flex-shrink-0 h-8 px-2">
              <ArrowLeft className="h-4 w-4 mr-1"/>Voltar
            </Button>
            <div className="flex-1 min-w-0 px-1">
              <p className="text-sm font-semibold truncate">{spot.name}</p>
              <p className="text-xs text-muted-foreground">{spot.region} da Ilha · {spot.level}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <ShareButton spot={spot}/>
              <button
                onClick={handleToggleFavorite}
                disabled={loadingFav}
                className={`p-2 rounded-xl border transition-colors ${favorite ? 'bg-red-500/10 border-red-500/40 text-red-500' : 'border-border hover:bg-muted/50'}`}
              >
                <Heart className={`h-4 w-4 ${favorite ? 'fill-current' : ''}`}/>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 pb-24 max-w-4xl space-y-5" style={{opacity:visible?1:0,transform:visible?'translateY(0)':'translateY(12px)',transition:'opacity 0.4s ease,transform 0.4s ease'}}>

        {/* Hero: beach name + score + quick metrics */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold leading-tight">{spot.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">{spot.region} da Ilha</span>
                <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">{spot.level}</span>
                {spot.bestTimeWindow && spot.bestTimeWindow !== 'Não recomendado hoje' && (
                  <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Clock className="h-3 w-3"/>{spot.bestTimeWindow}
                  </span>
                )}
              </div>
            </div>
            {/* Score */}
            <button
              onClick={() => setShowScoreExplainer(true)}
              className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl border border-border/50 bg-background p-3 min-w-[90px] hover:border-primary/40 transition-all active:scale-95"
            >
              <div className={`text-4xl font-bold leading-none ${rating.color}`}>{Number(spot.score).toFixed(1)}</div>
              <div className={`text-xs font-bold mt-1 ${rating.color}`}>{rating.label}</div>
              <div className="flex gap-0.5 mt-1.5">
                {[1,2,3,4,5].map(i=><div key={i} className={`h-1.5 w-4 rounded-full ${i<=rating.bars?rating.bg:'bg-muted'}`}/>)}
              </div>
              <div className="text-xs text-muted-foreground/50 mt-1.5">Score IA</div>
            </button>
          </div>

          {/* Navigation buttons — no topo para fácil acesso */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}&travelmode=driving`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 h-10 rounded-xl font-semibold text-sm text-white bg-primary hover:bg-primary/90 transition-all active:scale-95"
            >
              <Navigation className="h-4 w-4"/>Google Maps
            </a>
            <a
              href={`https://waze.com/ul?ll=${spot.lat},${spot.lng}&navigate=yes`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 h-10 rounded-xl font-semibold text-sm border border-border hover:bg-muted/50 transition-all active:scale-95"
            >
              <Navigation className="h-4 w-4"/>Waze
            </a>
          </div>

          {/* Quick metrics row */}
          <div className="grid grid-cols-4 gap-2">
            <div className="flex flex-col items-center gap-1 bg-muted/20 rounded-xl p-2.5">
              <Waves className="h-4 w-4 text-primary"/>
              <div className="text-base font-bold">{usesFeet?metersToFeet(spot.waveHeight):`${spot.waveHeight.toFixed(1)}m`}</div>
              <div className="text-xs text-muted-foreground text-center">Ondas</div>
            </div>
            <div className="flex flex-col items-center gap-1 bg-muted/20 rounded-xl p-2.5">
              <Wind className="h-4 w-4 text-accent"/>
              <div className="text-base font-bold">{Math.round(spot.windSpeed)}</div>
              <div className="text-xs text-muted-foreground text-center">km/h {windInfo.code}</div>
            </div>
            <div className="flex flex-col items-center gap-1 bg-muted/20 rounded-xl p-2.5">
              <Droplets className="h-4 w-4 text-cyan-500"/>
              <div className="text-base font-bold">{spot.waterConditions.temperature}°</div>
              <div className="text-xs text-muted-foreground text-center">Água</div>
            </div>
            <div className="flex flex-col items-center gap-1 bg-muted/20 rounded-xl p-2.5">
              <Sun className="h-4 w-4 text-yellow-500"/>
              <div className="text-base font-bold">{airTemp ? `${airTemp}°` : '—'}</div>
              <div className="text-xs text-muted-foreground text-center">Ar</div>
            </div>
          </div>
        </div>

        {/* Botão de relatos — com gatilho mental */}
        <button
          onClick={() => setCommentsOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-border/50 bg-card hover:border-primary/30 hover:bg-primary/5 transition-all"
        >
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-primary"/>
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold">O que dizem quem foi hoje?</div>
              <div className="text-xs text-muted-foreground">Relatos ao vivo de quem está na praia</div>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${commentsOpen ? 'rotate-180' : ''}`}/>
        </button>

        {commentsOpen && (
          <div className="rounded-2xl border border-border/50 bg-card p-4" style={{animation:'slideUp 0.2s ease-out'}}>
            <CommentsSection spot={spot}/>
          </div>
        )}

        {/* Tab selector */}
        <div className="flex rounded-xl bg-muted/30 p-1 border border-border/30">
          <button
            onClick={() => setActiveTab('agora')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'agora' ? 'bg-card shadow-sm text-foreground border border-border/40' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Waves className="h-4 w-4"/>Agora
          </button>
          <button
            onClick={() => setActiveTab('previsao')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'previsao' ? 'bg-card shadow-sm text-foreground border border-border/40' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Calendar className="h-4 w-4"/>Previsão
            {!isPremium && <Crown className="h-3 w-3 text-yellow-500"/>}
          </button>
        </div>

        {/* ── ABA AGORA ── */}
        {activeTab === 'agora' && (
          <div className="space-y-5">
            <PicosSection spot={spot}/>

            {/* Wave + Wind cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-primary">
                    <Waves className="h-4 w-4"/>
                    <span className="text-sm font-semibold">Ondulação</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="text-3xl font-bold">
                      {usesFeet?metersToFeet(spot.waveHeight):`${spot.waveHeight.toFixed(1)}m`}
                    </div>
                    <button
                      onClick={() => setUsesFeet(!usesFeet)}
                      className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors mb-1"
                    >
                      {usesFeet?'m':'ft'}
                    </button>
                  </div>
                  <AnimatedProgress value={spot.waveHeight*20}/>
                  <div className="pt-1 border-t border-border/30">
                    <div className="text-xs text-muted-foreground mb-1">Período</div>
                    <SwellPeriodBadge period={spot.swellPeriod}/>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Direção do Swell</div>
                    <div className="text-base font-semibold">{spot.swellDirection}</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-accent">
                    <Wind className="h-4 w-4"/>
                    <span className="text-sm font-semibold">Vento</span>
                  </div>
                  <WindCompass direction={spot.windDirection} speed={Math.round(spot.windSpeed)}/>
                  <AnimatedProgress value={Math.min(spot.windSpeed*2.5,100)}/>
                </CardContent>
              </Card>
            </div>

            {/* Tide */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-cyan-500"/>Como vai estar o mar hoje?
                </CardTitle>
              </CardHeader>
              <CardContent><TideChart tide={spot.tide}/></CardContent>
            </Card>

            {/* AI Analysis */}
            <Alert className="bg-primary/5 border-primary/20">
              <TrendingUp className="h-4 w-4 text-primary"/>
              <AlertTitle className="text-primary text-sm">Análise Inteligente</AlertTitle>
              <AlertDescription className="text-foreground text-sm">{analyzeConditions(spot)}</AlertDescription>
            </Alert>

            {/* Temperature + Equipment */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-1.5 text-foreground mb-1">
                  <Thermometer className="h-4 w-4"/>
                  <span className="text-sm font-semibold">Temperatura & Equipamento</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5"><Sun className="h-3 w-3"/>Ar</div>
                    <div className="text-2xl font-bold">{airTemp?`${airTemp}°C`:'—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5"><Droplets className="h-3 w-3"/>Água</div>
                    <div className="text-2xl font-bold">{spot.waterConditions.temperature}°C</div>
                  </div>
                </div>
                <Separator/>
                <div className="flex items-center gap-3">
                  <Waves className="h-4 w-4 text-muted-foreground flex-shrink-0"/>
                  <div>
                    <div className="text-xs text-muted-foreground">Neoprene</div>
                    <div className="text-sm font-semibold">{spot.waterConditions.wetsuit.thickness}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Compass className="h-4 w-4 text-muted-foreground flex-shrink-0"/>
                  <div>
                    <div className="text-xs text-muted-foreground">Prancha</div>
                    <div className="text-sm font-semibold">{spot.boardSuggestion}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sunrise/Sunset */}
            {(spot.sunrise || spot.sunset) && (
              <Card className="bg-yellow-500/5 border-yellow-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 text-yellow-500 mb-3">
                    <Sun className="h-4 w-4"/>
                    <span className="text-sm font-semibold">Luz do Dia</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground">🌅 Nascer do Sol</div>
                      <div className="text-lg font-semibold">{spot.sunrise}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">🌇 Pôr do Sol</div>
                      <div className="text-lg font-semibold">{spot.sunset}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {spot.score < 4 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4"/>
                <AlertTitle>Condições não ideais</AlertTitle>
                <AlertDescription>Este pico não está com boas condições. Considere outras praias ou aguarde melhora.</AlertDescription>
              </Alert>
            )}

          </div>
        )}

        {/* ── ABA PREVISÃO ── */}
        {activeTab === 'previsao' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Próximos dias</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isPremium ? '14 dias completos' : `${FREE_DAYS} dias gratuitos · Premium = 14 dias`}
                </p>
              </div>
              {!isPremium && (
                <button
                  onClick={() => navigate('/premium')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-yellow-500/40 bg-yellow-500/10 text-yellow-600 text-xs font-semibold hover:bg-yellow-500/15 transition-colors"
                >
                  <Crown className="h-3.5 w-3.5"/>Ver tudo
                </button>
              )}
            </div>

            {forecast.length === 0 ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <Waves className="h-5 w-5 text-primary animate-bounce"/>
                <span className="text-sm">Carregando previsão...</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {forecast.map((day, index) => (
                    <ForecastCard
                      key={day.date}
                      day={day}
                      index={index}
                      isPremium={isPremium}
                      usesFeet={usesFeet}
                      freeDays={FREE_DAYS}
                      onUpgrade={() => navigate('/premium')}
                    />
                  ))}
                </div>

                {!isPremium && (
                  <button
                    onClick={() => navigate('/premium')}
                    className="w-full py-4 rounded-2xl border border-dashed border-yellow-500/40 bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors text-center"
                  >
                    <Crown className="h-5 w-5 text-yellow-500 mx-auto mb-1"/>
                    <div className="text-sm font-semibold text-yellow-500">Ver previsão completa de 14 dias</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Assine o Premium por R$ 29,90/mês</div>
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <Button size="lg" variant="outline" className="w-full" onClick={() => navigate('/')}>
          Ver Todas as Praias
        </Button>
      </main>
    </div>
  )
}
