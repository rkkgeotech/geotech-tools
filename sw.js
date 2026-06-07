// RK&K Geotech Tools — Service Worker
// ─────────────────────────────────────────────────────────────────
// IMPORTANT: Bump CACHE version string on every deployment.
// This is what forces users' browsers to evict stale files and
// re-download everything fresh. If you update any tool and forget
// to bump this, field devices will keep running the old version.
//
//   Format: 'geotools-v<major>.<minor>'
//   Example after any update: 'geotools-v1.1', then 'geotools-v1.2', etc.
// ─────────────────────────────────────────────────────────────────
const CACHE = 'geotools-v1.3';

// ── PRE-CACHED ASSETS ─────────────────────────────────────────────
// Only field tools are pre-cached for guaranteed offline availability.
// Office calculators (earth pressure, Es, shear strength, etc.) are
// NOT listed here — they load normally from the network and get
// opportunistically cached on first visit, which is sufficient.
const ASSETS = [
  './index.html',
  './fieldlog-v2.html',
  './daily-log.html',
  './infiltration-test-log.html',
  './manifest.json',
  // Google Fonts
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Sans+Condensed:wght@600;700&display=swap',
  // SheetJS — used by FieldLog for gINT XLSX export
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// ── INSTALL ───────────────────────────────────────────────────────
// Fired once when the service worker is first registered (or when
// the CACHE version string changes). Pre-caches all listed assets
// so field tools are immediately available offline.
// If any asset fails to fetch, the entire install fails — the user
// is never left with a broken or partial cache.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()) // activate immediately, don't wait for old SW to idle out
  );
});

// ── ACTIVATE ──────────────────────────────────────────────────────
// Fired after install. Deletes all caches from prior versions so
// stale files don't linger on field devices after a version bump.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim()) // take control of already-open tabs immediately
  );
});

// ── FETCH ─────────────────────────────────────────────────────────
// Intercepts every network request.
// Strategy: Cache First — serve from cache if available, otherwise
// fetch from network (and cache the response for next time).
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // Not in cache — go to network
      return fetch(event.request).then(response => {
        // Only cache clean, successful responses.
        // Skips errors and opaque cross-origin responses.
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(() => {
        // Network failed and nothing in cache.
        // For HTML navigation requests, return the index so the user
        // can at least see the tool library and reach any cached tools.
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
        // For all other asset types (JS, CSS, fonts, etc.), just fail silently.
      });
    })
  );
});
