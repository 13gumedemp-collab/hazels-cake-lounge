"use client";
import { useEffect } from "react";

// The Command Centre is a live data app. Any service worker cache only causes
// stale orders/notifications, so tear it down completely and clear its caches.
export default function ServiceWorker() {
  useEffect(() => {
    (async () => {
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {}
      // No reload here: data is read live from the server, so there is nothing
      // to refresh, and a reload would fight a still-active worker (popups/loops).
    })();
  }, []);
  return null;
}
