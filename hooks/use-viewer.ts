"use client";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, isAbortError } from "@/lib/api-client";
import type { Profile } from "@/lib/types";

// Loads the signed-in viewer once. Everything else waits for `ready` so a cold
// load fetches the feed a single time.
export function useViewer(knownVisitor = false) {
  const [user, setUser] = useState<Profile | null>(null);
  // When the server already saw a request with no session cookie, there is
  // nobody to load: the landing page can render at once, on the server too.
  const [ready, setReady] = useState(knownVisitor);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (knownVisitor && attempt === 0) return;
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
  }, [attempt, knownVisitor]);

  const retry = useCallback(() => {
    setError("");
    setAttempt((n) => n + 1);
  }, []);

  return { user, setUser, ready, error, retry };
}
