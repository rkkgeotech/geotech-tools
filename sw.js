// FieldLog Service Worker
// Cache name — bump the version string whenever you deploy an update
// so users automatically get the new files.
const CACHE = 'fieldlog-v2.1';

// Everything the app needs to run offline
const ASSETS = [
  './index.html',
  './manifest.json',
  // Google Fonts — cached on first load, served locally after that
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Sans+Condensed:wght@600;700&display=swap',
  // SheetJS (used for gINT XLSX export)
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// ── INSTALL ──────────────────────────────────────────────────────
// Fired once when the service worker is first registered.
// Pre-caches all assets so the app is immediately available offline.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      // addAll fetches and caches every asset; if any fail the whole
      // install fails, so the user is never left with a broken cache.
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting()) // activate immediately, don't wait for old SW to expire
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────
// Fired after install. Deletes any caches from older versions so
// stale files don't linger after a CACHE version bump.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // take control of open tabs immediately
  );
});

// ── FETCH ─────────────────────────────────────────────────────────
// Intercepts every network request the app makes.
// Strategy: Cache First — serve from cache if available, fall back
// to network if not (and cache the response for next time).
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // Not in cache — fetch from network and cache the response
      return fetch(event.request).then(response => {
        // Only cache valid responses (not errors, not opaque cross-origin)
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(() => {
        // Network failed and nothing in cache — return a minimal offline fallback
        // for HTML navigation requests only
        if (event.request.destination === 'document') {
          return caches.match('./fieldlog-v2.html');
        }
      });
    })
  );
});
