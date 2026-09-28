// Artigo de cada praia ("o Campeche", "a Joaquina", "os Açores") pros textos da landing que
// citam praia no meio da frase (ChatDemo, PremiumMorning). Sem isso saía "eu iria na Novo
// Campeche". Naufragados se fala sem artigo ("em Naufragados").
const ARTICLE: Record<string, 'o' | 'a' | 'os' | ''> = {
  campeche: 'o', 'novo-campeche': 'o', 'morro-pedras': 'o', matadeiro: 'o', mocambique: 'o', santinho: 'o',
  joaquina: 'a', mole: 'a', 'barra-lagoa': 'a', armacao: 'a', 'lagoinha-leste': 'a', solidao: 'a',
  acores: 'os', naufragados: '',
}

export function withArticle(id: string, name: string): string {
  const a = ARTICLE[id] ?? ''
  return a ? `${a} ${name}` : name
}
