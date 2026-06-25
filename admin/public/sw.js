// Bumped cache name forces the old (over-eager) cache to be deleted on activate.
const CACHE = "hcl-cc-v2";
const OFFLINE = "/offline.html";
const PRECACHE = [OFFLINE, "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // NEVER cache live data: APIs and Next.js RSC/data payloads always go to network.
  if (url.pathname.startsWith("/api/") || url.search.includes("_rsc") || req.headers.get("RSC")) {
    return; // let the browser handle it (network)
  }

  // Page navigations: network first, fall back to the offline page.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }

  // Immutable hashed build assets: cache first (safe, content-hashed).
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        }),
      ),
    );
    return;
  }

  // Everything else: network first, fall back to cache if offline.
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});

// Push notifications
self.addEventListener("push", (e) => {
  let data = { title: "Hazel's Command Centre", body: "You have a new update." };
  try { data = e.data ? e.data.json() : data; } catch {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: "/icon.svg", badge: "/icon.svg",
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow("/"));
});
