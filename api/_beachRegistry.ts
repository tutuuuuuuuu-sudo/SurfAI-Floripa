// Cadastro de praias (id/nome/região/coordenadas/orientação) — fonte única usada por todos
// os crons de backend (content-agent, daily-report, email-alert, push-notify, snapshot,
// spot-meta). Antes cada um mantinha sua própria cópia — 7 no total contando o cadastro
// "canônico" de src/lib/surfData.ts — e uma delas (content-agent.ts) já tinha divergido de
// verdade (3 praias com orientação errada, achado da auditoria de 22/ago/2026).
//
// Coordenadas e orientação continuam espelhando `BEACHES` em src/lib/surfData.ts (que tem
// campos adicionais — subRegions, bestTimeWindow, hikeAccess — usados só pelo frontend, por
// isso não foi extraído pra cá). Qualquer mudança de coordenada precisa ser replicada nos
// dois lugares — coordenadas foram confirmadas pelo usuário no Google Maps, não alterar sem
// confirmação explícita (ver CLAUDE.md).
//
// Prefixo _ indica que não é um handler HTTP — não será exposto como endpoint pelo Vercel.

export interface BeachRegistryEntry {
  id: string
  name: string
  region: 'Sul' | 'Centro' | 'Norte'
  lat: number
  lng: number
  orientation: number
  // Quanto o vento sul (S/SSE/SSW) pega na praia: 1 = em cheio (padrão); menor = mais protegida.
  // A nota usa a velocidade × esse valor na curva do sul (api/_scoreEngine.ts). Conhecimento
  // local do usuário (01/out/2026), ver southExposureAt abaixo.
  southExposure?: number
}

export const BEACH_REGISTRY: BeachRegistryEntry[] = [
  { id: 'campeche', name: 'Campeche', region: 'Sul', lat: -27.697703, lng: -48.4898603, orientation: 90 },
  { id: 'novo-campeche', name: 'Novo Campeche', region: 'Centro', lat: -27.6661001, lng: -48.4755307, orientation: 90 },
  { id: 'morro-pedras', name: 'Morro das Pedras', region: 'Sul', lat: -27.7170897, lng: -48.503436, orientation: 100 },
  { id: 'matadeiro', name: 'Matadeiro', region: 'Sul', lat: -27.7548429, lng: -48.4985647, orientation: 110, southExposure: 0.5 },
  { id: 'lagoinha-leste', name: 'Lagoinha do Leste', region: 'Sul', lat: -27.7732103, lng: -48.4863806, orientation: 180 },
  { id: 'acores', name: 'Açores', region: 'Sul', lat: -27.7837144, lng: -48.5236746, orientation: 120 },
  { id: 'solidao', name: 'Solidão', region: 'Sul', lat: -27.7941233, lng: -48.5334965, orientation: 130 },
  { id: 'armacao', name: 'Armação', region: 'Sul', lat: -27.7504078, lng: -48.5017637, orientation: 115, southExposure: 0.85 },
  { id: 'naufragados', name: 'Naufragados', region: 'Sul', lat: -27.8335587, lng: -48.5641537, orientation: 180 },
  { id: 'joaquina', name: 'Joaquina', region: 'Centro', lat: -27.6293577, lng: -48.4490173, orientation: 90 },
  { id: 'mole', name: 'Praia Mole', region: 'Centro', lat: -27.6022459, lng: -48.4326839, orientation: 85 },
  { id: 'mocambique', name: 'Moçambique', region: 'Norte', lat: -27.4937746, lng: -48.3955175, orientation: 80 },
  { id: 'barra-lagoa', name: 'Barra da Lagoa', region: 'Centro', lat: -27.5734502, lng: -48.424939, orientation: 75, southExposure: 0.7 },
  { id: 'santinho', name: 'Santinho', region: 'Norte', lat: -27.4618653, lng: -48.3761513, orientation: 70 },
]

// Proteção ao vento sul (01/out/2026, usuário — surfista local):
// - Matadeiro 0,5: "quando tem vento sul a maioria dos surfistas vai pra lá"
// - Armação 0,85: "já não protege tanto, mas é mais protegida que o Morro das Pedras, Campeche,
//   Novo Campeche e toda essa faixa de areia" (essas ficam em 1)
// - Barra da Lagoa 0,7: "o vento sul chega meio de terral lá (vem da areia, não do mar)" — a
//   orientação (75°) confirma: o sul entra de lado vindo um pouco da terra
// As outras ficam em 1 até haver observação real (Registro do mar real) dizendo o contrário.
// Procura pela posição (até ~2 km) porque previsão e app passam lat/lng, não o id da praia.
export function southExposureAt(lat: number, lng: number): number {
  let best: BeachRegistryEntry | undefined, bestD = Infinity
  for (const b of BEACH_REGISTRY) {
    const d = Math.hypot(b.lat - lat, (b.lng - lng) * Math.cos((lat * Math.PI) / 180))
    if (d < bestD) { bestD = d; best = b }
  }
  return best && bestD < 0.02 ? (best.southExposure ?? 1) : 1
}

export function getBeach(id: string): BeachRegistryEntry | undefined {
  return BEACH_REGISTRY.find(b => b.id === id)
}

export function getBeaches(ids: string[]): BeachRegistryEntry[] {
  return ids.map(getBeach).filter((b): b is BeachRegistryEntry => b !== undefined)
}
