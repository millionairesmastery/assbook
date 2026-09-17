"use client";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, isAbortError } from "@/lib/api-client";
import type { Profile } from "@/lib/types";

// Loads the signed-in viewer once. Everything else waits for `ready` so a cold
// load fetches the feed a single time.
export function useViewer() {
  const [user, setUser] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api<{ user: Profile | null }>("me", { signal: controller.signal })
      .then((data) => {
        setUser(data.user);
        setError("");
        setReady(true);
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setError(errorMessage(cause));
        setReady(true);
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setError("");
    setAttempt((n) => n + 1);
  }, []);

  return { user, setUser, ready, error, retry };
}
