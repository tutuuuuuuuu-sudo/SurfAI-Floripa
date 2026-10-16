import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Bell, BellOff, Share, X } from 'lucide-react'
import {
  subscribeToNotifications,
  unsubscribeFromPush,
  getNotificationPermission,
  getSavedNotificationSettings,
  saveNotificationSettings,
  sendTestPush,
} from '@/lib/notifications'
import type { BeachCondition } from '@/lib/surfData'
import { PremiumUpsellBanner } from '@/components/PremiumUpsellBanner'

type NotificationSettings = ReturnType<typeof getSavedNotificationSettings>

interface Props {
  spots: BeachCondition[]
  favorites: string[]
  isPremium: boolean
}

// iPhone/iPad (inclui iPad que se apresenta como Mac). Desde o iOS 16.4 o iPhone recebe alertas
// de app web, mas SÓ com o app instalado na tela de início — no Safari aberto não existe push.
// Antes de 30/set/2026 o painel dizia "o iOS não suporta" pra qualquer iPhone e escondia o botão.
function iosPushState(): 'not-ios' | 'needs-install' | 'too-old' | 'ok' {
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  if (!isIOS) return 'not-ios'
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (!standalone) return 'needs-install'
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window ? 'ok' : 'too-old'
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
  const [testing, setTesting] = useState(false)
  const [open, setOpen] = useState(false)
  const ios = iosPushState()
  const iosBlocked = ios === 'needs-install' || ios === 'too-old'
  const active = settings.enabled && permission === 'granted'
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
    } else {
      setPermission(getNotificationPermission())
    }
    setLoading(false)
  }

  // Qualquer mudança de critério (nota mínima, só favoritas, nota por praia) com o alerta ligado
  // reenvia a inscrição: o servidor manda o push com o app fechado usando o critério salvo lá.
  // Antes só a nota por praia fazia isso — trocar a nota mínima não chegava no servidor.
  const persist = (s: NotificationSettings) => {
    setSettings(s)
    saveNotificationSettings(s)
    if (s.enabled && permission === 'granted') {
      subscribeToNotifications(s.minScore, s.favoriteOnly, s.beachThresholds).catch(() => {})
    }
  }

  const setBeachThreshold = (beachId: string, score: number | null) => {
    const beachThresholds = { ...settings.beachThresholds }
    if (score === null) delete beachThresholds[beachId]
    else beachThresholds[beachId] = score
    persist({ ...settings, beachThresholds })
  }

  const handleDisable = () => {
    const s = { ...settings, enabled: false }
    setSettings(s)
    saveNotificationSettings(s)
    unsubscribeFromPush().catch(() => {})
  }

  // O servidor espera ~8 s antes de mandar: o teste mais fiel é com o app fechado (no iPhone o
  // alerta aparece na tela de bloqueio/no topo). Só diz "entregue" quando o serviço de push deste
  // tipo de aparelho (Apple no iPhone) aceitou — antes dizia "deve chegar" mesmo quando a Apple recusava.
  const handleTest = async () => {
    setTesting(true)
    toast.info('Saia do app agora (volte pra tela inicial): o alerta de teste chega em uns 10 segundos.')
    const results = await sendTestPush()
    setTesting(false)
    if (!results) { toast.error('Não deu pra enviar o teste agora. Tente de novo em alguns segundos.'); return }
    if (results.length === 0) { toast.info('Este aparelho ainda não está inscrito. Desligue e ligue os alertas de novo.'); return }
    const mine = results.filter(r => r.apple === (ios === 'ok'))
    const delivered = mine.find(r => r.ok)
    if (delivered) toast.success(ios === 'ok' ? 'A Apple aceitou o alerta de teste.' : 'Alerta de teste entregue.')
    else toast.error(`O alerta foi recusado${mine[0] ? ` (código ${mine[0].status})` : ''}. Tente desligar e ligar os alertas de novo.`)
  }

  const trigger = (
    <button
      onClick={() => setOpen(true)}
      className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border bg-card/60 text-foreground/85 hover:border-primary/30'
      }`}
    >
      {active ? <><Bell className="h-4 w-4" />Alertas ativos</> : <><BellOff className="h-4 w-4" />Alertas</>}
    </button>
  )

  if (!open) return trigger

  // Abre como janela centralizada por cima da tela, não dentro da linha do topo da Home: ali ele
  // vazava pela direita no celular e a página inteira encolhia (bug visto no iPhone, 30/set/2026)
  return (
    <>
      {trigger}
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      >
        <Card
          className="w-full max-w-md max-h-[85dvh] overflow-y-auto overscroll-contain border-primary/20"
          style={{ animation: 'slideUp 0.3s ease-out' }}
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-label="Alertas de Condições"
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />Alertas de Condições
              </CardTitle>
              <button onClick={() => setOpen(false)} aria-label="Fechar"><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isPremium && (
              <PremiumUpsellBanner
                title="Alertas de swell são Premium"
                subtitle="Receba um push quando o mar bater bom nas suas praias"
              />
            )}
            {isPremium && ios === 'needs-install' && (
              <div className="space-y-2 text-sm bg-muted/30 border border-border rounded-lg p-3">
                <div className="font-semibold">No iPhone, os alertas chegam pelo app instalado</div>
                <ol className="list-decimal pl-5 space-y-1 text-xs text-muted-foreground">
                  <li>
                    No Safari, toque em Compartilhar
                    <Share className="inline h-3.5 w-3.5 mx-1 align-[-2px]" aria-hidden="true" />
                  </li>
                  <li>Escolha <strong className="text-foreground">Adicionar à Tela de Início</strong></li>
                  <li>Abra o Surf AI pelo ícone novo e ative os alertas aqui</li>
                </ol>
              </div>
            )}
            {isPremium && ios === 'too-old' && (
              <p className="text-xs text-muted-foreground">
                Pra receber alertas no iPhone, atualize pro iOS 16.4 ou mais novo.
              </p>
            )}
            {isPremium && !iosBlocked && permission === 'unsupported' && (
              <p className="text-xs text-muted-foreground">Seu navegador não suporta notificações. Tente pelo Chrome.</p>
            )}
            {isPremium && !iosBlocked && permission === 'denied' && (
              <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3">
                {ios === 'ok'
                  ? 'Notificações bloqueadas. Abra Ajustes do iPhone → Notificações → Surf AI e permita.'
                  : 'Notificações bloqueadas. Clique no cadeado na barra de endereços e permita.'}
              </div>
            )}
            {isPremium && !iosBlocked && (permission === 'default' || permission === 'granted') && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Receber alertas</div>
                    <div className="text-xs text-muted-foreground">Quando as condições estiverem boas</div>
                  </div>
                  <button
                    onClick={active ? handleDisable : handleEnable}
                    disabled={loading}
                    aria-label={active ? 'Desligar alertas' : 'Ligar alertas'}
                    className={`relative w-11 h-6 rounded-full transition-colors ${active ? 'bg-primary' : 'bg-muted'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${active ? 'left-6' : 'left-1'}`} />
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
                          onClick={() => persist({ ...settings, minScore: score })}
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
                      onClick={() => persist({ ...settings, favoriteOnly: !settings.favoriteOnly })}
                      aria-label="Só favoritas"
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
                {active && (
                  <button
                    onClick={handleTest}
                    disabled={testing}
                    className="w-full text-xs py-2 border border-primary/30 rounded-lg text-primary hover:bg-primary/10 transition-colors disabled:opacity-60"
                  >
                    {testing ? 'Enviando…' : 'Enviar alerta de teste'}
                  </button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
