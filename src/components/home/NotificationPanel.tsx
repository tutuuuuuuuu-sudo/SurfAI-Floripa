import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Bell, BellOff, X } from 'lucide-react'
import {
  subscribeToNotifications,
  unsubscribeFromPush,
  getNotificationPermission,
  getSavedNotificationSettings,
  saveNotificationSettings,
  checkAndNotifyGoodConditions,
} from '@/lib/notifications'
import type { BeachCondition } from '@/lib/surfData'
import { PremiumUpsellBanner } from '@/components/PremiumUpsellBanner'

interface Props {
  spots: BeachCondition[]
  favorites: string[]
  isPremium: boolean
}

// isPremium vem por prop (não usePremium() de novo aqui) — Home.tsx já chama o
// hook, e duas instâncias simultâneas tentavam se inscrever no mesmo canal
// realtime do Supabase (subscription:${user.id}) ao mesmo tempo, o que quebrava
// a Home inteira com "cannot add postgres_changes callbacks... after subscribe()"
// (bug real encontrado testando em produção, não pego por type-check/testes).
export function NotificationPanel({ spots, favorites, isPremium }: Props) {
  const [permission, setPermission] = useState(getNotificationPermission())
  const [settings, setSettings] = useState(getSavedNotificationSettings())
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const favoriteSpots = spots.filter(s => favorites.includes(s.id))

  const handleEnable = async () => {
    if (!isPremium) return
    setLoading(true)
    const success = await subscribeToNotifications(settings.minScore, settings.favoriteOnly, settings.beachThresholds)
    if (success) {
      const s = { ...settings, enabled: true }
      setSettings(s)
      saveNotificationSettings(s)
      setPermission('granted')
    }
    setLoading(false)
  }

  // Nota por praia é enviada pro servidor (push com app fechado) — se o alerta já
  // está ativo, precisa reenviar a subscription pra atualizar o critério salvo lá.
  // (mesma lacuna já existe hoje pra minScore/favoriteOnly — não é nova neste ponto)
  const setBeachThreshold = (beachId: string, score: number | null) => {
    const beachThresholds = { ...settings.beachThresholds }
    if (score === null) delete beachThresholds[beachId]
    else beachThresholds[beachId] = score
    const s = { ...settings, beachThresholds }
    setSettings(s)
    saveNotificationSettings(s)
    if (s.enabled && permission === 'granted') {
      subscribeToNotifications(s.minScore, s.favoriteOnly, s.beachThresholds).catch(() => {})
    }
  }

  const handleDisable = () => {
    const s = { ...settings, enabled: false }
    setSettings(s)
    saveNotificationSettings(s)
    unsubscribeFromPush().catch(() => {})
  }

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-colors ${
        settings.enabled && permission === 'granted'
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border text-muted-foreground hover:border-primary/30'
      }`}
    >
      {settings.enabled && permission === 'granted'
        ? <><Bell className="h-3.5 w-3.5" />Alertas ativos</>
        : <><BellOff className="h-3.5 w-3.5" />Alertas</>
      }
    </button>
  )

  return (
    <Card className="border-primary/20" style={{ animation: 'slideUp 0.3s ease-out' }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />Alertas de Condições
          </CardTitle>
          <button onClick={() => setOpen(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isPremium && (
          <PremiumUpsellBanner
            title="Alertas de swell são Premium"
            subtitle="Receba um push quando o mar bater bom nas suas praias"
          />
        )}
        {isPremium && isIOS && (
          <div className="text-xs bg-muted/30 border border-border rounded-lg p-3 text-muted-foreground">
            😤 <strong>iPhone/iPad:</strong> O Safari no iOS não suporta notificações push em aplicações web.
          </div>
        )}
        {isPremium && !isIOS && permission === 'unsupported' && (
          <p className="text-xs text-muted-foreground">Seu navegador não suporta notificações. Tente pelo Chrome.</p>
        )}
        {isPremium && !isIOS && permission === 'denied' && (
          <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3">
            Notificações bloqueadas. Clique no cadeado na barra de endereços e permita.
          </div>
        )}
        {isPremium && !isIOS && (permission === 'default' || permission === 'granted') && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Receber alertas</div>
                <div className="text-xs text-muted-foreground">Quando as condições estiverem boas</div>
              </div>
              <button
                onClick={settings.enabled && permission === 'granted' ? handleDisable : handleEnable}
                disabled={loading}
                className={`relative w-11 h-6 rounded-full transition-colors ${settings.enabled && permission === 'granted' ? 'bg-primary' : 'bg-muted'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.enabled && permission === 'granted' ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <Separator />
            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold mb-2">Nota mínima</div>
                <div className="flex gap-2">
                  {[6, 7, 8, 9].map(score => (
                    <button
                      key={score}
                      onClick={() => { const s = { ...settings, minScore: score }; setSettings(s); saveNotificationSettings(s) }}
                      className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${settings.minScore === score ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border text-muted-foreground'}`}
                    >
                      {score}+
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold">Só favoritas</div>
                <button
                  onClick={() => { const s = { ...settings, favoriteOnly: !settings.favoriteOnly }; setSettings(s); saveNotificationSettings(s) }}
                  className={`relative w-11 h-6 rounded-full transition-colors ${settings.favoriteOnly ? 'bg-primary' : 'bg-muted'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.favoriteOnly ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
              {favoriteSpots.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="text-xs font-semibold mb-0.5">Nota mínima por praia</div>
                    <div className="text-[11px] text-muted-foreground mb-2">Sobrepõe a nota geral só pra essa praia</div>
                    <div className="space-y-2">
                      {favoriteSpots.map(spot => {
                        const custom = settings.beachThresholds[spot.id]
                        return (
                          <div key={spot.id} className="flex items-center justify-between gap-2">
                            <span className="text-xs truncate flex-1">{spot.name}</span>
                            <div className="flex gap-1">
                              {[6, 7, 8, 9].map(score => (
                                <button
                                  key={score}
                                  onClick={() => setBeachThreshold(spot.id, custom === score ? null : score)}
                                  className={`w-7 py-1 text-[11px] rounded-lg border transition-colors ${
                                    custom === score
                                      ? 'border-primary bg-primary/10 text-primary font-bold'
                                      : 'border-border text-muted-foreground hover:border-primary/30'
                                  }`}
                                >
                                  {score}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
            {settings.enabled && permission === 'granted' && (
              <button
                onClick={async () => {
                  const sent = await checkAndNotifyGoodConditions(spots, favorites, settings.minScore, settings.favoriteOnly, settings.beachThresholds)
                  if (sent > 0) toast.success('Notificação de teste enviada!')
                  else toast.info('Nenhuma praia atinge o score agora, nada a notificar.')
                }}
                className="w-full text-xs py-2 border border-primary/30 rounded-lg text-primary hover:bg-primary/10 transition-colors"
              >
                Testar notificação
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
