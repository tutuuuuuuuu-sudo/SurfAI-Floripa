import { Waves, Store } from 'lucide-react'

const CONTACT_EMAIL = 'surfaifloripa@gmail.com'

export interface AdData {
  id: string
  empresa: string
  slogan: string
  imagem_url: string
  link_url: string
}

export const PLACEHOLDER_AD: AdData = {
  id: 'placeholder',
  empresa: 'Sua Empresa Aqui',
  slogan: `Anuncie para surfistas de Floripa • ${CONTACT_EMAIL}`,
  imagem_url: '',
  link_url: 'mailto:surfaifloripa@gmail.com',
}

export function AdBanner({ ad = PLACEHOLDER_AD }: { ad?: AdData }) {
  return (
    <a
      href={ad.link_url}
      target={ad.id === 'placeholder' ? '_self' : '_blank'}
      rel="noopener noreferrer"
      className="block w-full rounded-xl border border-border/40 overflow-hidden hover:border-primary/30 transition-all"
      style={{ textDecoration: 'none' }}
    >
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/10">
        {ad.imagem_url
          ? <img src={ad.imagem_url} alt={ad.empresa} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" onError={e => { e.currentTarget.style.display = 'none' }} />
          : <div className="w-12 h-12 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0"><Waves className="h-6 w-6 text-muted-foreground" /></div>
        }
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold truncate">{ad.empresa}</div>
          <div className="text-xs text-muted-foreground truncate">{ad.slogan}</div>
        </div>
        <span className="text-xs text-muted-foreground/50 bg-muted/20 px-2 py-0.5 rounded-full flex-shrink-0">Patrocinado</span>
      </div>
    </a>
  )
}

export function AdCard({ ad = PLACEHOLDER_AD }: { ad?: AdData }) {
  return (
    <a
      href={ad.link_url}
      target={ad.id === 'placeholder' ? '_self' : '_blank'}
      rel="noopener noreferrer"
      className="block"
      style={{ textDecoration: 'none' }}
    >
      <div className="rounded-xl border border-dashed border-border/50 hover:border-primary/30 bg-muted/5 hover:bg-primary/5 transition-all p-4 flex items-center gap-3">
        {ad.imagem_url
          ? <img src={ad.imagem_url} alt={ad.empresa} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" onError={e => { e.currentTarget.style.display = 'none' }} />
          : <div className="w-10 h-10 rounded-lg bg-muted/20 flex items-center justify-center flex-shrink-0"><Store className="h-5 w-5 text-muted-foreground" /></div>
        }
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate">{ad.empresa}</div>
          <div className="text-xs text-muted-foreground truncate">{ad.slogan}</div>
        </div>
        <span className="text-xs text-muted-foreground/40 flex-shrink-0">Patrocinado</span>
      </div>
    </a>
  )
}
