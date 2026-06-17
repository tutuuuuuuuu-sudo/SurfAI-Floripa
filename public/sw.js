// sw.js — Service Worker Surf AI Floripa
// Versão: incrementar esse número a cada deploy para forçar atualização
const CACHE_VERSION = 'surf-ai-v6'

// Assets do app shell que devem funcionar offline
const APP_SHELL = ['/', '/index.html']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION) // mantém apenas o cache atual
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // Chamadas de API: Network Only — nunca servir do cache (dados precisam ser frescos)
  if (url.pathname.startsWith('/api/') || url.hostname !== self.location.hostname) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
    return
  }

  // Assets estáticos (JS, CSS, imagens): Cache First com atualização em background
  if (
    event.request.destination === 'script' ||
    event.request.destination === 'style' ||
    event.request.destination === 'image' ||
    event.request.destination === 'font'
  ) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async cache => {
        const cached = await cache.match(event.request)
        const networkFetch = fetch(event.request).then(res => {
          if (res.ok) cache.put(event.request, res.clone())
          return res
        }).catch(() => null)
        // Retorna o cache imediatamente se disponível, atualiza em background
        return cached ?? (await networkFetch) ?? new Response('', { status: 503 })
      })
    )
    return
  }

  // Navegação (HTML): Network First, fallback para index.html (SPA)
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match('/index.html')
    )
  )
})

// ── Web Push ──────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { data = { title: 'Surf AI', body: event.data.text() } }

  const { title = 'Surf AI', body = '', icon = '/icon-192.png', badge = '/icon-192.png', url = '/' } = data

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      data: { url },
      tag: 'surf-alert',
      renotify: true,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const existing = clientList.find(c => c.url.includes(self.location.origin))
      if (existing) return existing.focus().then(c => c.navigate(url))
      return clients.openWindow(url)
    })
  )
})
