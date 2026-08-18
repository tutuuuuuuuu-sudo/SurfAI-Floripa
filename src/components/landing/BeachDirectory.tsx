import { MapPin } from 'lucide-react'
import { Reveal } from '@/components/landing/LandingComponents'
import { BEACH_DIRECTORY, type BeachRegion } from '@/lib/beachDirectory'
import photoNorte from '@/assets/landing/directory-norte.jpg'
import photoCentro from '@/assets/landing/directory-centro.jpg'
import photoSul from '@/assets/landing/directory-sul.jpg'

// Prova social honesta em vez de depoimento inventado: cobertura real das praias
// monitoradas, com nome real. As fotos são reais (confirmadas pelo usuário, não
// geradas por IA), mas o pareamento foto↔região é só estético — nenhuma das 3 tem
// praia específica confirmada, então não afirmamos "essa é a foto de tal praia".
const REGION_ORDER: BeachRegion[] = ['Norte', 'Centro', 'Sul']
const REGION_PHOTO: Record<BeachRegion, string> = { Norte: photoNorte, Centro: photoCentro, Sul: photoSul }

// Sul tem quase 4x mais praias que o Norte — sem isso os 3 cards ficariam com
// alturas bem diferentes, ou a lista de pílulas brigaria com a foto.
const MAX_VISIBLE_BEACHES = 5

export function BeachDirectory() {
  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {REGION_ORDER.map((region, i) => {
        const beaches = BEACH_DIRECTORY.filter(b => b.region === region)
        const visibleBeaches = beaches.slice(0, MAX_VISIBLE_BEACHES)
        const hiddenCount = beaches.length - visibleBeaches.length

        return (
          <Reveal key={region} delay={i * 0.1}>
            <div className="group relative h-64 sm:h-72 md:h-80 rounded-2xl overflow-hidden border border-border/50">
              <img
                src={REGION_PHOTO[region]}
                alt={`Praias da região ${region} de Florianópolis`}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              {/* Véu leve na foto inteira (não só na base) pra ela não competir com o
                  texto em nenhum ponto do card, ainda com tokens de tema. */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'color-mix(in oklch, var(--color-background) 28%, transparent)' }}
              />
              {/* Degradê funde a base da foto no fundo do tema (não numa cor fixa),
                  então o texto continua legível em claro e escuro. */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(180deg, transparent 0%, transparent 35%, '
                    + 'color-mix(in oklch, var(--color-background) 88%, transparent) 68%, '
                    + 'color-mix(in oklch, var(--color-background) 97%, transparent) 100%)',
                }}
              />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-4 w-4 text-primary" />
                  <h3 className="font-bold text-sm">{region} da ilha</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{beaches.length} {beaches.length === 1 ? 'praia' : 'praias'}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {visibleBeaches.map(b => (
                    <span key={b.id}
                      className="text-xs font-medium text-foreground/80 bg-background/60 border border-border/40 rounded-full px-3 py-1.5">
                      {b.name}
                    </span>
                  ))}
                  {hiddenCount > 0 && (
                    <span className="text-xs font-medium text-foreground/80 bg-background/60 border border-border/40 rounded-full px-3 py-1.5">
                      +{hiddenCount} mais
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Reveal>
        )
      })}
    </div>
  )
}
