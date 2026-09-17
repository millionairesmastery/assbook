"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

const POLL_MS = 60000;

/**
 * The number on the bell. Asked for when the app opens, whenever the tab
 * comes back into view, and once a minute while it stays open. Opening the
 * list marks everything read and the number goes.
 */
export function useNotifications(enabled: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const load = () =>
      api<{ unread: number }>("notifications/unread", { signal: controller.signal })
        .then((data) => setCount(data.unread))
        .catch(() => {
          // A missed poll is nothing; the next one comes in a minute.
        });
    load();
    const timer = setInterval(load, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);

  const markRead = useCallback(async () => {
    setCount(0);
    try {
      await api("notifications/read", { method: "POST", body: {} });
    } catch {
      // The list was shown; the count catches up on the next poll.
    }
  }, []);

  return { unread: enabled ? count : 0, markRead };
}
