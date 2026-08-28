/* DrosoTracker service worker (PWA).
   Strategy:
   - The HTML (navigation): NETWORK first, cache as fallback → online you always get the
     latest version; offline, it opens the last one saved.
   - Icons / manifest / fonts: CACHE first, refreshed in the background.
   ASSETS_REV is NOT the version of DrosoTracker: that one is v1 (Zenodo / the preprint), and
   v2 is the release for Fly. This only names the bucket the icons and the manifest are kept
   in, and it is dated rather than numbered precisely so the two can never be read as the same
   thing. The app itself does not need it touched -- the HTML is network-first, so a plain
   reload already brings the latest code. Change it only when one of the ASSETS below changes,
   or to make every installed PWA drop its offline copy. Never as part of a deploy. */
const ASSETS_REV = '2026-08-28';
const CACHE = 'drosotracker-assets-' + ASSETS_REV;
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
