const CACHE = "hcl-cc-v1";
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
  // Navigations: network first, fall back to the offline page.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }
  // Static assets: cache first, then network.
  e.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => cached),
    ),
  );
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
