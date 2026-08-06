/* DrosoTracker service worker (PWA).
   Strategy:
   - The HTML (navigation): NETWORK first, cache as fallback → online you always get the
     latest version; offline, it opens the last one saved.
   - Icons / manifest / fonts: CACHE first, refreshed in the background.
   Bump VERSION whenever you want to force a clean update. */
const VERSION = 'v12';
const CACHE = 'drosotracker-' + VERSION;
const ASSETS = [
  './',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Do not intercept Google Identity / Calendar API (auth and API calls go straight to the network).
  if (/(accounts\.google\.com|googleapis\.com|apis\.google\.com)/.test(new URL(req.url).host)) return;

  // The HTML document: network first (no HTTP cache → always the latest), cache as fallback.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'reload' })
        .then(res => {
          if (!res.redirected) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./', copy)); }
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./')))
    );
    return;
  }

  // Everything else (icons, manifest, fonts): cache first + background refresh.
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          caches.open(CACHE).then(c => c.put(req, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
