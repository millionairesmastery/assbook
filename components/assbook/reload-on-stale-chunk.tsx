"use client";
import { useEffect } from "react";

// After a deploy the build's chunk names change. A page loaded before the
// deploy can still ask for the old ones and fail; Vite reports that as a
// preload error. One reload fetches the current page and the current chunks.
export function ReloadOnStaleChunk() {
  useEffect(() => {
    const onError = (event: Event) => {
      event.preventDefault();
      const key = "assbook-reloaded-for-chunk";
      try {
        if (sessionStorage.getItem(key) === location.href) return;
        sessionStorage.setItem(key, location.href);
      } catch {
        // Storage may be unavailable; reloading once is still the right call.
      }
      location.reload();
    };
    window.addEventListener("vite:preloadError", onError);
    return () => window.removeEventListener("vite:preloadError", onError);
  }, []);
  return null;
}
