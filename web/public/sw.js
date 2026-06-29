// Service worker — app shell offline cache + push notifications
const CACHE_NAME = 'hl-shell-v2'
const SHELL_URLS = ['/', '/index.html', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_URLS).catch(() => {})))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.pathname.startsWith('/api/')) return // never cache API
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(resp => {
      if (resp.ok && req.url.startsWith(self.location.origin)) {
        const copy = resp.clone()
        caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {})
      }
      return resp
    }).catch(() => cached))
  )
})

// Push notification handler
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'iSehat', body: event.data ? event.data.text() : 'Pengingat baru' }
  }

  const title = data.title || 'iSehat'
  const options = {
    body: data.body || 'Pengingat baru',
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200]
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

// Notification click handler — open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus existing window if one is open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          client.focus()
          client.navigate(targetUrl)
          return
        }
      }
      // Open new window
      return self.clients.openWindow(targetUrl)
    })
  )
})
