// US-4.6.2 Service worker — app shell offline cache
const CACHE_NAME = 'hl-shell-v1'
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
