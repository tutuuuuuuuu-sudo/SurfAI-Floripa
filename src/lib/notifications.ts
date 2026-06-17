import { lsGet, lsSet, lsGetJson, lsSetJson } from './utils'
import { supabase } from './supabase'

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const pad = base64String.length % 4 === 0 ? '' : '='.repeat(4 - (base64String.length % 4))
  const base64 = (base64String + pad).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export async function subscribeToNotifications(
  minScore = 7,
  favoriteOnly = true
): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const granted = await requestNotificationPermission()
    if (!granted) return false

    // Se não tiver VAPID key configurada, cai para notificação local apenas
    if (!VAPID_PUBLIC_KEY) return true

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    // Salva subscription no servidor para push quando app estiver fechado
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ subscription, minScore, favoriteOnly }),
      }).catch(() => {}) // falha silenciosa — notificação local ainda funciona
    }

    return true
  } catch {
    return false
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    if (!reg) return
    const sub = await reg.pushManager.getSubscription()
    if (sub) await sub.unsubscribe()

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      await fetch('/api/push-subscribe', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {})
    }
  } catch { /* silencioso */ }
}

export async function sendLocalNotification(title: string, body: string, url?: string) {
  if (!('serviceWorker' in navigator)) return
  if (Notification.permission !== 'granted') return

  try {
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: url ?? '/' },
      tag: 'surf-alert',
    })
  } catch {
    new Notification(title, { body })
  }
}

export function getSavedNotificationSettings(): {
  enabled: boolean
  minScore: number
  favoriteOnly: boolean
} {
  return lsGetJson('notification_settings', { enabled: false, minScore: 7, favoriteOnly: true })
}

export function saveNotificationSettings(settings: {
  enabled: boolean
  minScore: number
  favoriteOnly: boolean
}) {
  lsSetJson('notification_settings', settings)
}

export async function checkAndNotifyGoodConditions(
  spots: { id: string, name: string, score: number, tide?: string, bestTimeWindow?: string }[],
  favorites: string[],
  minScore: number,
  favoriteOnly: boolean
) {
  if (Notification.permission !== 'granted') return

  const now = Date.now()
  const notifiedKey = 'notified_spots_v2'
  const notifiedMap: Record<string, number> = lsGetJson(notifiedKey, {})

  // Limpa entradas antigas (> 6h)
  const cleaned: Record<string, number> = {}
  for (const [id, ts] of Object.entries(notifiedMap)) {
    if (now - ts < 6 * 60 * 60 * 1000) cleaned[id] = ts
  }

  const goodSpots = spots.filter(s => {
    if (s.score < minScore) return false
    if (favoriteOnly && !favorites.includes(s.id)) return false
    // Não renotifica a mesma praia em menos de 6h
    if (cleaned[s.id] && now - cleaned[s.id] < 6 * 60 * 60 * 1000) return false
    return true
  }).sort((a, b) => b.score - a.score)

  if (goodSpots.length === 0) return

  // Notifica no máximo 2 praias por vez para não spammar
  const toNotify = goodSpots.slice(0, 2)
  for (const spot of toNotify) {
    const tideCtx = spot.tide === 'Enchendo' || spot.tide === 'Cheia'
      ? ' · Maré boa'
      : spot.tide === 'Secando' ? ' · Maré secando' : ''
    const windowCtx = spot.bestTimeWindow && !spot.bestTimeWindow.includes('Aguardar')
      ? ` · ${spot.bestTimeWindow}` : ''

    await sendLocalNotification(
      `${spot.name} está ótima agora!`,
      `Score ${spot.score.toFixed(1)}/10${tideCtx}${windowCtx}`,
      `/spot/${spot.id}`
    )
    cleaned[spot.id] = now
  }

  lsSetJson(notifiedKey, cleaned)
}
