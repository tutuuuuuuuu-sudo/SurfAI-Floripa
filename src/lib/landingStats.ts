// Contador anônimo da landing (api/landing-event.ts → tabela landing_stats): só o total do dia
// de visitas e de cliques em cada botão, sem cookie, sem IP e sem identificar ninguém — por
// isso roda sem o aviso de cookies. Só conta no domínio de verdade (teste local e links de
// teste da Vercel usam o mesmo banco e iam sujar os números).
export type LandingCta =
  | 'nav' | 'hero' | 'hero-planos' | 'curva'
  | 'preco-mensal' | 'preco-anual' | 'preco-gratis'
  | 'fechamento' | 'fechamento-planos'

function send(event: 'view' | 'cta', detail = '') {
  try {
    if (!location.hostname.endsWith('surfaifloripa.com.br')) return
    const body = JSON.stringify({ event, detail })
    // sendBeacon sobrevive à troca de página (o clique leva pro cadastro na mesma hora)
    if (navigator.sendBeacon?.('/api/landing-event', body)) return
    void fetch('/api/landing-event', { method: 'POST', body, keepalive: true }).catch(() => {})
  } catch {
    // contador nunca pode atrapalhar a página
  }
}

export const countLandingView = () => send('view')
export const countLandingCta = (where: LandingCta) => send('cta', where)
