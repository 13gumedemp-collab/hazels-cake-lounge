// Kill-switch worker. Its only job is to take control away from any older,
// over-caching worker and then remove itself, leaving the app with no service
// worker at all (the Command Centre reads live data, so it never needs one).
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        await self.clients.claim();
        await self.registration.unregister();
      } catch (e) {
        /* ignore */
      }
    })(),
  );
});

// Pass everything straight through to the network. No caching, ever.
self.addEventListener("fetch", () => {});
