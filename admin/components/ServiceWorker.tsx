"use client";
import { useEffect } from "react";

// The Command Centre is a live data app. Any service worker cache only causes
// stale orders/notifications, so tear it down completely and clear its caches.
export default function ServiceWorker() {
  useEffect(() => {
    (async () => {
      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
          // If an old worker was still controlling this tab, one reload frees it.
          if (navigator.serviceWorker.controller && !sessionStorage.getItem("hcl_sw_off")) {
            sessionStorage.setItem("hcl_sw_off", "1");
            window.location.reload();
          }
        }
      } catch {}
    })();
  }, []);
  return null;
}
