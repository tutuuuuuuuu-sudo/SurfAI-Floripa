// Praias com página aberta sem login — arquivo leve (sem imports) pra poder ser usado tanto
// pelo app (surfData.ts re-exporta) quanto pelos endpoints de servidor (spot-meta.ts,
// landing-day.ts) sem arrastar código de navegador junto. Antes spot-meta.ts tinha uma
// cópia própria dessa lista.

// Picos vitrine: acessíveis em /spot/:id sem login, para reduzir a fricção de entrada
// de quem chega por link direto, busca ou anúncio — vê o produto real antes de criar conta.
export const PUBLIC_SPOT_IDS = ['joaquina', 'mole'] as const

// Picos teaser: resumo real aberto sem login, mas previsão/maré/janela ideal ficam
// borrados atrás de CTA. Meio-termo entre PUBLIC_SPOT_IDS (100% aberto) e o resto
// (100% fechado) — usado para SEO/compartilhamento sem abrir mão do cadastro.
export const TEASER_SPOT_IDS = ['campeche', 'novo-campeche', 'matadeiro', 'santinho'] as const
