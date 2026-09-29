import { useMemo } from 'react'
import { useSurfData } from '@/contexts/SurfDataContext'
import { getRatingInfo } from '@/lib/rating'
import { projectLatLng } from '@/components/landing/islandShape'

// Amostras de cada faixa pra legenda — só lê o rótulo/cor de getRatingInfo, sem repetir os cortes
const LEGEND = [9, 7.5, 6, 4.5, 2].map(s => getRatingInfo(s))

// Praias de norte a sul com a posição no desenho da ilha + resumo "Agora na ilha" por faixa de
// nota. Usado pela transição do topo da landing (Hero.tsx): pontos no mapa de satélite + lista
// (IslandBeachList.tsx).
export function useIslandBeaches() {
  const { conditions } = useSurfData()
  const beaches = useMemo(
    () => [...conditions].sort((a, b) => b.lat - a.lat).map(c => ({ ...c, pos: projectLatLng(c.lat, c.lng) })),
    [conditions]
  )
  const summary = useMemo(() => {
    const counts = new Map<string, number>()
    for (const b of beaches) {
      const label = getRatingInfo(b.score).label
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return LEGEND.filter(l => counts.has(l.label)).map(l => ({ ...l, n: counts.get(l.label)! }))
  }, [beaches])
  return { beaches, summary }
}

export type IslandRatingSummary = ReturnType<typeof useIslandBeaches>['summary']
export type IslandBeach = ReturnType<typeof useIslandBeaches>['beaches'][number]
