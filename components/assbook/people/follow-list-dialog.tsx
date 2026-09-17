"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FollowButton, PersonRow } from "@/components/assbook/people/person-row";
import { api, errorMessage, isAbortError } from "@/lib/api-client";
import type { Profile } from "@/lib/types";

export type FollowListMode = "followers" | "following";

const COPY = {
  followers: {
    title: "Right behind them",
    empty: "Nobody back here yet. It only takes one.",
  },
  following: {
    title: "Falling behind",
    empty: "Not following anyone yet. Plenty of people to pick from.",
  },
};

/**
 * The people behind a profile, or the people it follows. The list owns its own
 * follow state so the buttons work inside the dialog, and tells the page about
 * every change so the header counts and the rail stay honest.
 */
export function FollowListDialog({
  mode,
  handle,
  name,
  isSelf,
  viewerId,
  onVisit,
  onRequireUser,
  onFollowed,
  onClose,
}: {
  mode: FollowListMode;
  handle: string;
  name: string;
  isSelf: boolean;
  viewerId: string;
  onVisit: (handle: string) => void;
  onRequireUser: () => boolean;
  onFollowed: (person: Profile, following: number) => void;
  onClose: () => void;
}) {
  const [people, setPeople] = useState<Profile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const controller = new AbortController();
    api<{ people: Profile[] }>(
      "profile/" + encodeURIComponent(handle) + "/" + mode,
      { signal: controller.signal },
    )
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
  }, [handle, mode, attempt]);


  const patch = useCallback((id: string, following: number) => {
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

  const follow = useCallback(
    async (person: Profile) => {
      if (!onRequireUser()) return;
      if (pending.has(person.id)) return;
      const next = person.following ? 0 : 1;
      patch(person.id, next);
      setPending((current) => new Set(current).add(person.id));
      try {
        await api("follow/" + person.id, { method: next ? "PUT" : "DELETE" });
        onFollowed(person, next);
        toast.success(
          next
            ? "You’re right behind " + person.name + "."
            : "You’re going your own way.",
        );
      } catch (cause) {
        patch(person.id, next ? 0 : 1);
        toast.error(errorMessage(cause));
      } finally {
        setPending((current) => {
          const rest = new Set(current);
          rest.delete(person.id);
          return rest;
        });
      }
    },
    [onFollowed, onRequireUser, patch, pending],
  );

  const who = isSelf ? "you" : "@" + handle;
  const description =
    mode === "followers"
      ? "The people right behind " + who + "."
      : (isSelf ? "You are" : name + " is") + " right behind these people.";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="assbook-dialog">
        <DialogHeader>
          <DialogTitle>{COPY[mode].title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="form-error" role="alert">
            <p>{error}</p>
            <button
              className="quiet"
              onClick={() => {
                setError("");
                setAttempt((n) => n + 1);
              }}
            >
              <RefreshCw size={15} aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : !loaded ? (
          <p className="muted" role="status">
            <Loader2 className="spin" size={18} aria-hidden="true" /> Rounding
            people up…
          </p>
        ) : people.length === 0 ? (
          <p className="muted">{COPY[mode].empty}</p>
        ) : (
          people.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              onVisit={onVisit}
              action={
                person.id === viewerId ? undefined : (
                  <FollowButton
                    person={person}
                    pending={pending.has(person.id)}
                    onFollow={(target) => void follow(target)}
                  />
                )
              }
            />
          ))
        )}
      </DialogContent>
    </Dialog>
  );
}
