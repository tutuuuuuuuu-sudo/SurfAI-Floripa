import { X } from 'lucide-react'
import { BeachCondition } from '@/lib/surfData'
import { getRatingInfo } from '@/lib/rating'

export const ScoreExplainer = ({ spot, onClose }: { spot: BeachCondition, onClose: () => void }) => {
  const rating = getRatingInfo(spot.score)
  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
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
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-xl">{item.icon}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">{item.label}</span>
                  <span className="text-sm font-bold text-primary">{item.value.toFixed(1)}/10</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className="bg-primary h-1.5 rounded-full transition-all duration-700" style={{width:`${Math.min(100,(item.value/item.max)*100)}%`}}/>
                </div>
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
