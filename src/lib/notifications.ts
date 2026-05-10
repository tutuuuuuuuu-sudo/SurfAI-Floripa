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

export async function subscribeToNotifications(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false

  try {
    await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const granted = await requestNotificationPermission()
    if (!granted) return false

    return true
  } catch (error) {
    console.error('Erro ao registrar service worker:', error)
    return false
  }
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
  try {
    const saved = localStorage.getItem('notification_settings')
    if (saved) return JSON.parse(saved)
  } catch (_) {}
  return { enabled: false, minScore: 7, favoriteOnly: true }
}

export function saveNotificationSettings(settings: {
  enabled: boolean
  minScore: number
  favoriteOnly: boolean
}) {
  try {
    localStorage.setItem('notification_settings', JSON.stringify(settings))
  } catch (_) {}
}

export async function checkAndNotifyGoodConditions(
  spots: { id: string, name: string, score: number }[],
  favorites: string[],
  minScore: number,
  favoriteOnly: boolean
) {
  if (Notification.permission !== 'granted') return

  const lastNotified = localStorage.getItem('last_notified_time')
  const now = Date.now()

  if (lastNotified && now - Number(lastNotified) < 60 * 60 * 1000) return

  const goodSpots = spots.filter(s => {
    if (s.score < minScore) return false
    if (favoriteOnly && !favorites.includes(s.id)) return false
    return true
  })

  if (goodSpots.length === 0) return

  const best = goodSpots.sort((a, b) => b.score - a.score)[0]
  await sendLocalNotification(
    `🔥 ${best.name} está excelente agora!`,
    `Score ${best.score.toFixed(1)} — Clique para ver as condições`,
    `/spot/${best.id}`
  )

  localStorage.setItem('last_notified_time', String(now))
}
