"use client";
import { useEffect } from "react";

// The Command Centre is a live data app: a service worker cache only causes
// stale orders/notifications. Unregister any previously installed worker and
// clear its caches so the dashboard always shows fresh data.
export default function ServiceWorker() {
  useEffect(() => {
    const hadController = "serviceWorker" in navigator && !!navigator.serviceWorker.controller;
    const cleanup = async () => {
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
      // If an old worker was serving this page, one reload gets truly fresh data.
      if (hadController && !sessionStorage.getItem("hcl_sw_cleared")) {
        sessionStorage.setItem("hcl_sw_cleared", "1");
        window.location.reload();
      }
    };
    cleanup();
  }, []);
  return null;
}
