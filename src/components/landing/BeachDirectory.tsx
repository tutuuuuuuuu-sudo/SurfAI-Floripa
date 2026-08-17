import { MapPin } from 'lucide-react'
import { Reveal } from '@/components/landing/LandingComponents'
import { BEACH_DIRECTORY, type BeachRegion } from '@/lib/beachDirectory'

// Prova social honesta em vez de depoimento inventado: cobertura real das praias
// monitoradas, com nome real. Fotos reais por praia podem ser adicionadas depois
// (campo `image` por id, opcional) sem mudar a estrutura.
const REGION_ORDER: BeachRegion[] = ['Norte', 'Centro', 'Sul']

export function BeachDirectory() {
  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {REGION_ORDER.map((region, i) => {
        const beaches = BEACH_DIRECTORY.filter(b => b.region === region)

        return (
          <Reveal key={region} delay={i * 0.1}>
            <div className="h-full rounded-2xl p-5 bg-card/40 border border-border/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm">{region} da ilha</h3>
                <span className="text-xs text-muted-foreground ml-auto">{beaches.length} {beaches.length === 1 ? 'praia' : 'praias'}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {beaches.map(b => (
                  <span key={b.id}
                    className="text-xs font-medium text-foreground/80 bg-background/60 border border-border/40 rounded-full px-3 py-1.5">
                    {b.name}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        )
      })}
    </div>
  )
}
