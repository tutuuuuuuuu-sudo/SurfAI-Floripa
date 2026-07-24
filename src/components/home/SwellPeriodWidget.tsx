import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Waves, ChevronDown, ChevronUp } from 'lucide-react'

const PERIODS = [
  { range: '< 8s',   label: 'Fraco',     cls: 'text-rating-poor',      bgCls: 'bg-rating-poor',      desc: 'Vento local, ondas curtas e bagunçadas. Difícil de surfar.' },
  { range: '8-10s',  label: 'Regular',   cls: 'text-rating-fair',      bgCls: 'bg-rating-fair',      desc: 'Ondulação moderada. Surfável mas sem muita qualidade.' },
  { range: '10-12s', label: 'Bom',       cls: 'text-rating-good',      bgCls: 'bg-rating-good',      desc: 'Boa ondulação. Ondas bem formadas e com energia.' },
  { range: '12-14s', label: 'Muito Bom', cls: 'text-rating-excellent', bgCls: 'bg-rating-excellent', desc: 'Excelente! Ondas longas, limpas e com muito poder.' },
  { range: '> 14s',  label: 'Épico',     cls: 'text-rating-epic',      bgCls: 'bg-rating-epic',      desc: 'Swell de longo período. Ondas perfeitas e muito potentes.' },
]

export function SwellPeriodWidget() {
  const [open, setOpen] = useState(false)
  return (
    <Card className="border-primary/20 bg-primary/5 card-hover anim-slide" style={{ animationDelay: '0.3s' }}>
      <button className="w-full text-left" onClick={() => setOpen(!open)}>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Waves className="h-4 w-4 text-primary" />O que significa o período do swell?
            </CardTitle>
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardHeader>
      </button>
      {open && (
        <CardContent className="px-4 pb-4 space-y-2" style={{ animation: 'slideUp 0.3s ease-out' }}>
          <p className="text-xs text-muted-foreground mb-3">
            O período é o tempo em segundos entre duas ondas consecutivas. Quanto maior, mais organizada e poderosa é a ondulação.
          </p>
          <div className="space-y-2">
            {PERIODS.map(p => (
              <div key={p.range} className="flex items-start gap-3">
                <div className={`min-w-[52px] text-xs font-bold rounded px-1.5 py-0.5 text-center text-white ${p.bgCls}`}>
                  {p.range}
                </div>
                <div>
                  <span className={`text-xs font-semibold ${p.cls}`}>{p.label}</span>
                  <span className="text-xs text-muted-foreground ml-1">— {p.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
