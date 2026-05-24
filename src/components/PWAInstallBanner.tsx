// PWAInstallBanner.tsx — Banner "Instalar App" com design do Surf AI
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const wasDismissed = (() => { try { return localStorage.getItem('pwa-banner-dismissed') === 'true' } catch { return false } })()
    const navigatorExt = window.navigator as Navigator & { standalone?: boolean }
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || navigatorExt.standalone === true
    if (wasDismissed || isStandalone) return

    // MSStream é propriedade do IE11 — seu presença indica IE, não iOS real
    const windowExt = window as Window & { MSStream?: unknown }
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !windowExt.MSStream
    setIsIOS(ios)

    if (ios) {
      const timer = setTimeout(() => setShow(true), 3000)
      return () => clearTimeout(timer)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') handleDismiss()
    }
  }

  const handleDismiss = () => {
    setShow(false)
    setDismissed(true)
    try { localStorage.setItem('pwa-banner-dismissed', 'true') } catch { /* ignore */ }
  }

  if (!show || dismissed) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50" style={{ animation: 'slideUp 0.4s ease-out' }}>
      <div className="flex items-center gap-3 p-3 rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-md shadow-2xl">
        <div
          className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #061220 100%)', border: '1px solid rgba(6,182,212,0.3)' }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M4 18 Q9 13 14 17 Q19 21 24 16" stroke="#06b6d4" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
            <path d="M5 13 Q10 8 14 12 Q18 16 23 11" stroke="#22d3ee" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
            <path d="M7 8 Q11 4 14 7 Q17 10 21 6" stroke="#67e8f9" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold">Surf AI Floripa</div>
          {isIOS ? (
            <p className="text-xs text-muted-foreground leading-snug mt-0.5">
              Toque em <strong>Compartilhar ⎙</strong> → <strong>"Adicionar à Tela de Início"</strong>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">Instale para acesso rápido na tela inicial</p>
          )}
        </div>
        {!isIOS && (
          <button
            onClick={handleInstall}
            className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl text-white transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)' }}
          >
            Instalar
          </button>
        )}
        <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 p-1">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
