import { Crown, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface PremiumUpsellBannerProps {
  title: string
  subtitle: string
  ctaLabel?: string
}

// Banner único de upgrade pra Premium — usar sempre que precisar de uma chamada
// pra assinatura dentro de outra página (não confundir com a própria página /premium).
export function PremiumUpsellBanner({ title, subtitle, ctaLabel = 'Premium' }: PremiumUpsellBannerProps) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate('/premium')}
      className="w-full flex items-center gap-3 p-4 rounded-2xl border border-rating-fair/40 bg-rating-fair/10 hover:bg-rating-fair/15 transition-colors text-left shadow-sm shadow-rating-fair/20"
    >
      <div className="h-10 w-10 rounded-xl bg-rating-fair/20 flex items-center justify-center flex-shrink-0">
        <Crown className="h-5 w-5 text-rating-fair" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-rating-fair">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <span className="flex-shrink-0 flex items-center gap-1 text-xs font-bold text-rating-fair bg-rating-fair/15 px-2.5 py-1.5 rounded-lg">
        {ctaLabel}<ChevronRight className="h-3 w-3" />
      </span>
    </button>
  )
}
