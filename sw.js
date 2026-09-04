// BCH Builders Lab — service worker
// Bump CACHE version whenever you redeploy so users get fresh content.
const CACHE = 'bch-builders-lab-v17';
const CORE = [
  '/',
  '/index.html',
  '/support',
  '/lab-floor',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.webmanifest',
  '/updates.json'
];

// Install: pre-cache the core shell
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

// Activate: clean up old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for the page (so content stays fresh),
// cache-first for static assets, offline fallback to cached shell.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Don't cache cross-origin API calls (CoinGecko price, Luma, etc.) — always go to network
  if (url.origin !== self.location.origin) return;

  // HTML: network-first, fall back to cache when offline
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('/')))
    );
    return;
  }

  // updates.json: network-first so the feed stays fresh, fall back to cache offline
  if (url.pathname === '/updates.json') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Static assets: cache-first
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }))
  );
});
