"use client";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, isAbortError } from "@/lib/api-client";
import type { Profile } from "@/lib/types";

// The person shown on the profile view, keyed by handle so switching people
// never leaves the previous person on screen.
export function useProfile(handle: string, viewerId: string, ready: boolean) {
  const [entry, setEntry] = useState<{ handle: string; profile: Profile } | null>(
    null,
  );
  const [failure, setFailure] = useState<{ handle: string; message: string } | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!handle || !ready) return;
    const controller = new AbortController();
    api<{ profile: Profile }>("profile/" + encodeURIComponent(handle), {
      signal: controller.signal,
    })
      .then((data) => {
        setEntry({ handle, profile: data.profile });
        setFailure(null);
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setFailure({ handle, message: errorMessage(cause) });
      });
    return () => controller.abort();
  }, [handle, viewerId, ready, attempt]);

  const profile = entry && entry.handle === handle ? entry.profile : null;
  const error = failure && failure.handle === handle ? failure.message : "";

  const retry = useCallback(() => {
    setFailure(null);
    setAttempt((n) => n + 1);
  }, []);

  const patchFollowing = useCallback((id: string, following: number) => {
    setEntry((current) =>
      current && current.profile.id === id
        ? {
            ...current,
            profile: {
              ...current.profile,
              following,
              followers: Math.max(
                0,
                (current.profile.followers ?? 0) + (following ? 1 : -1),
              ),
            },
          }
        : current,
    );
  }, []);

  const merge = useCallback((id: string, patch: Partial<Profile>) => {
    setEntry((current) =>
      current && current.profile.id === id
        ? { ...current, profile: { ...current.profile, ...patch } }
        : current,
    );
  }, []);

  return {
    profile,
    loading: !!handle && ready && !profile && !error,
    error,
    retry,
    patchFollowing,
    merge,
  };
}
