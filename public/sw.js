/**
 * Thought Cloud Service Worker
 *
 * Strategy:
 *   /api/*           → network-only (always live)
 *   /_next/static/*  → cache-first (immutable build hashes; safe to cache forever)
 *   everything else  → stale-while-revalidate (serve cached app shell instantly, update in background)
 *
 * Note: Service workers require HTTPS or localhost. On a local network over plain HTTP
 * (e.g. http://192.168.x.x:3000 on an iPad), the SW will not activate — the app still
 * works normally, just without offline caching. Use localhost for dev/testing.
 */

const CACHE = "thought-cloud-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(["/"]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

// App shell pages (HTML): always network-first so fresh CSS/JS references are served immediately.
// /_next/static/ assets: cache-first — these have content hashes and never change.
// /api/*: always network-only.

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API routes: always network
  if (url.pathname.startsWith("/api/")) return;

  // Next.js static assets (content-hashed): cache-first, safe to cache forever
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Everything else (page HTML, manifests): network-first so updates are immediate.
  // Fall back to cache only if network is unavailable.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
