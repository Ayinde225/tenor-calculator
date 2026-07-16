/*
 * Tenor service worker — offline-first.
 *
 * The calculator must work with no network at all once installed. Strategy:
 *  - App shell (navigations): network-first, falling back to the cached shell, so
 *    a fresh deploy is picked up online but the app still opens offline.
 *  - Everything else (hashed JS/CSS, icons): stale-while-revalidate — serve the
 *    cached copy instantly and refresh it in the background. Vite's content hashes
 *    make each asset immutable, so a cached hit is always correct.
 *
 * No build step writes a precache manifest here; the shell is cached on install
 * and assets are cached lazily as they are first fetched. That keeps the worker
 * dependency-free at the cost of the very first offline load needing one prior
 * online visit, which is the standard PWA contract.
 */
const VERSION = 'tenor-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          caches.open(VERSION).then((cache) => cache.put('./index.html', response.clone()));
          return response;
        })
        .catch(() => caches.match('./index.html').then((r) => r ?? caches.match('./'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(VERSION).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => cached);
      return cached ?? network;
    }),
  );
});
