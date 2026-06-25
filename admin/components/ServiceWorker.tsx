"use client";
import { useEffect } from "react";

// The Command Centre reads live data and needs no service worker. If an old
// worker is still controlling the tab, register the kill-switch worker (sw.js)
// which claims control and then unregisters itself. Otherwise just make sure
// nothing is registered. No reloads, so there are never popups or loops.
export default function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    } else {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      }
    }
  }, []);
  return null;
}
