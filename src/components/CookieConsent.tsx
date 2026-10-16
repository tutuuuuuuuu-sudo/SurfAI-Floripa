import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Shield } from 'lucide-react'
import { disableAnalytics, enableAnalytics } from '@/lib/monitoring'

const CONSENT_KEY = 'analytics_consent'

export function CookieConsent() {
  // Aparece só pra quem ainda não decidiu (modo privado sem localStorage: não aparece)
  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem(CONSENT_KEY) === null } catch { return false }
  })
  const location = useLocation()

  // Landing é página de vendas pré-cadastro — pedir consentimento de analytics
  // antes do usuário nem saber o que é o app só polui visualmente. Lá nada é coletado sem o
  // aviso: só o contador anônimo de visitas/cliques (src/lib/landingStats.ts), sem cookie.
  if (location.pathname.startsWith('/landing')) return null

  // O PostHog só é ligado aqui, no "Aceitar" (ou no início, pra quem já aceitou antes) —
  // antes disso nada é coletado (monitoring.ts). Recusar não baixa nem liga nada.
  const handleAccept = () => {
    try { localStorage.setItem(CONSENT_KEY, 'accepted') } catch { /* */ }
    setVisible(false)
    enableAnalytics()
  }

  const handleDecline = () => {
    try { localStorage.setItem(CONSENT_KEY, 'declined') } catch { /* */ }
    setVisible(false)
    disableAnalytics()
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 px-4 pb-2 md:bottom-4">
      <div className="max-w-lg mx-auto bg-card border border-border rounded-2xl shadow-lg p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">Privacidade & Analytics</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Usamos analytics (PostHog) para melhorar o app. Nenhum dado é vendido.{' '}
              <Link to="/privacy" className="text-primary underline underline-offset-2">
                Saiba mais
              </Link>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleDecline}>
            Recusar
          </Button>
          <Button size="sm" className="flex-1" onClick={handleAccept}>
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  )
}
