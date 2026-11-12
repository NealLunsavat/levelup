// Service worker: makes the app open instantly and work offline.
// When you change any app file, bump CACHE so every device picks up the new version.
const CACHE = 'levelup-v1';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/components.js',
  'js/game.js',
  'js/logsheet.js',
  'js/pages.js',
  'js/settings.js',
  'js/store.js',
  'js/sync.js',
  'js/util.js',
  'vendor/preact-htm.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Sync traffic is live data and must never come from the cache.
  if (url.hostname.endsWith('supabase.co')) return;

  if (req.mode === 'navigate') {
    // Page loads: try the network for the latest version, fall back to the cached app offline.
    event.respondWith(fetch(req).catch(() => caches.match('index.html')));
    return;
  }

  // Everything else: serve from cache, and cache anything new (like the sync library) on first use.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => cached || fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy));
      }
      return res;
    })),
  );
});
