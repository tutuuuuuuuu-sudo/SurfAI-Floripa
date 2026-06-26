import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Shield } from 'lucide-react'

const CONSENT_KEY = 'analytics_consent'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONSENT_KEY)
      if (saved === null) setVisible(true)
    } catch {
      // modo privado — não exibe o banner
    }
  }, [])

  const handleAccept = () => {
    try { localStorage.setItem(CONSENT_KEY, 'accepted') } catch { /* */ }
    setVisible(false)
  }

  const handleDecline = () => {
    try { localStorage.setItem(CONSENT_KEY, 'declined') } catch { /* */ }
    setVisible(false)
    // Desabilita PostHog se o usuário recusar
    if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).posthog) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).posthog?.opt_out_capturing()
    }
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
