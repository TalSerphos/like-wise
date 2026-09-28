// LikeWise service worker: installability + offline fallback.
// Bump VERSION to drop old caches after changing caching behavior.
const VERSION = "v1";
const STATIC_CACHE = `likewise-static-${VERSION}`;
const PAGES_CACHE = `likewise-pages-${VERSION}`;
const OFFLINE_PAGES = { he: "/he/offline", en: "/en/offline" };

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES_CACHE)
      .then((cache) => cache.addAll(Object.values(OFFLINE_PAGES)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== PAGES_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Hashed build assets and icons never change: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // Pages: network-first, falling back to the last cached copy, then offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Personal pages are never cached, so a signed-out device can't show them.
          if (response.ok && !/^\/(he|en)\/me(\/|$)/.test(url.pathname)) {
            const copy = response.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const locale = url.pathname.startsWith("/en") ? "en" : "he";
          return caches.match(OFFLINE_PAGES[locale]);
        }),
    );
  }
});
