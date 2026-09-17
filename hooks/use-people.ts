"use client";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, isAbortError } from "@/lib/api-client";
import type { Profile } from "@/lib/types";

export function usePeople(viewerId: string, ready: boolean) {
  const [people, setPeople] = useState<Profile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    api<{ people: Profile[] }>("people", { signal: controller.signal })
      .then((data) => {
        setPeople(data.people);
        setError("");
        setLoaded(true);
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setError(errorMessage(cause));
        setLoaded(true);
      });
    return () => controller.abort();
  }, [viewerId, ready, attempt]);

  const retry = useCallback(() => {
    setError("");
    setAttempt((n) => n + 1);
  }, []);

  const revalidate = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  // Optimistic follow state: used before the request settles, and again to roll
  // it back when the request fails.
  const patchFollowing = useCallback((id: string, following: number) => {
    setPeople((current) =>
      current.map((person) =>
        person.id === id
          ? {
              ...person,
              following,
              followers: Math.max(
                0,
                (person.followers ?? 0) + (following ? 1 : -1),
              ),
            }
          : person,
      ),
    );
  }, []);

  return {
    people,
    loading: ready && !loaded,
    error,
    retry,
    revalidate,
    patchFollowing,
  };
}
