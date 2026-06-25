"use client";
import { useEffect } from "react";

// Register the network-first worker (sw.js) which never caches APIs or page
// data. It uses skipWaiting + clients.claim, so it takes over any tab still
// held by an older, over-caching worker. One reload on takeover gives fresh data.
export default function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Clear any stale caches left by older worker versions.
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!sessionStorage.getItem("hcl_sw_reloaded")) {
        sessionStorage.setItem("hcl_sw_reloaded", "1");
        window.location.reload();
      }
    });
  }, []);
  return null;
}
