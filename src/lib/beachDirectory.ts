// Lista estática leve (id/name/region) das praias monitoradas — sem os imports pesados
// de weatherApi/weatherData/_scoreEngine que `surfData.ts` traz junto. Existe pra que a
// Landing (carregada sem lazy-load de propósito, pro visitante anônimo não baixar o app
// inteiro) e qualquer outro lugar que só precise "quantas/quais praias" não precise
// importar o módulo pesado. Fonte única do número real de praias — nunca hardcode a
// contagem em outro lugar, use BEACH_DIRECTORY.length.
//
// Precisa ficar em sincronia com o array BEACHES em src/lib/surfData.ts (nome e região).
// Coordenadas, orientação e sub-regiões ficam só em surfData.ts — aqui é só o essencial
// pra listagem/contagem.

export type BeachRegion = 'Norte' | 'Centro' | 'Sul'

export interface BeachDirectoryEntry {
  id: string
  name: string
  region: BeachRegion
}

export const BEACH_DIRECTORY: BeachDirectoryEntry[] = [
  { id: 'campeche', name: 'Campeche', region: 'Sul' },
  { id: 'novo-campeche', name: 'Novo Campeche', region: 'Centro' },
  { id: 'morro-pedras', name: 'Morro das Pedras', region: 'Sul' },
  { id: 'matadeiro', name: 'Matadeiro', region: 'Sul' },
  { id: 'lagoinha-leste', name: 'Lagoinha do Leste', region: 'Sul' },
  { id: 'acores', name: 'Açores', region: 'Sul' },
  { id: 'solidao', name: 'Solidão', region: 'Sul' },
  { id: 'armacao', name: 'Armação', region: 'Sul' },
  { id: 'naufragados', name: 'Naufragados', region: 'Sul' },
  { id: 'joaquina', name: 'Joaquina', region: 'Centro' },
  { id: 'mole', name: 'Praia Mole', region: 'Centro' },
  { id: 'mocambique', name: 'Moçambique', region: 'Norte' },
  { id: 'barra-lagoa', name: 'Barra da Lagoa', region: 'Centro' },
  { id: 'santinho', name: 'Santinho', region: 'Norte' },
]

export const REGION_COUNT = 3 // Norte, Centro, Sul
