/* Service worker de DrosoTracker (PWA).
   Estrategia:
   - El HTML (navegación): RED primero, caché de respaldo → con internet ves siempre lo último;
     sin internet, abre la última versión guardada.
   - Íconos / manifest / fuentes: CACHÉ primero, y se actualizan en segundo plano.
   Subí VERSION cada vez que quieras forzar una actualización limpia. */
const VERSION = 'v5';
const CACHE = 'drosotracker-' + VERSION;
const ASSETS = [
  'DrosoTracker.html',
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

  // No interceptar Google Identity / Calendar API (auth y llamadas a la API van directo a la red).
  if (/(accounts\.google\.com|googleapis\.com|apis\.google\.com)/.test(new URL(req.url).host)) return;

  // El documento HTML: red primero (sin caché HTTP → siempre lo último), caché de respaldo.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'reload' })
        .then(res => {
          if (!res.redirected) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('DrosoTracker.html', copy)); }
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('DrosoTracker.html')))
    );
    return;
  }

  // Resto (íconos, manifest, fuentes): caché primero + refresco en segundo plano.
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
