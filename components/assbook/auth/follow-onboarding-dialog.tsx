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

type Suggestions = { people: Profile[]; required: number; following: number };

const PROGRESS_ID = "onboarding-progress";

/**
 * The one step every new member goes through: follow a few people, so the
 * Following feed has something in it. The list owns its own follow state and
 * reports every change to the page, the way the follow list dialog does.
 *
 * While the quota is unmet the dialog ignores Escape and clicks outside, so
 * the only ways out are finishing or the quiet "Skip for now" button. Skipping
 * leaves onboarding undone, and the dialog comes back on the next visit.
 */
export function FollowOnboardingDialog({
  onFollowed,
  onDone,
  onSkip,
}: {
  onFollowed: (person: Profile, following: number) => void;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [people, setPeople] = useState<Profile[]>([]);
  const [required, setRequired] = useState(0);
  // Follows the member already had when the dialog opened, plus the ones made
  // here. Counting both is what the server does before it lets us finish.
  const [already, setAlready] = useState(0);
  const [picked, setPicked] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api<Suggestions>("suggestions", { signal: controller.signal })
      .then((data) => {
        setPeople(data.people);
        setRequired(data.required);
        setAlready(data.following);
        setPicked(0);
        setError("");
        setLoaded(true);
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setError(errorMessage(cause));
        setLoaded(true);
      });
    return () => controller.abort();
  }, [attempt]);

  const followed = already + picked;
  const enough = followed >= required;
  // Nothing loaded yet means nothing is known about the quota, so hold the
  // door shut until the answer arrives.
  const locked = !loaded || (required > 0 && !enough);

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
      if (pending.has(person.id)) return;
      const next = person.following ? 0 : 1;
      const step = next ? 1 : -1;
      patch(person.id, next);
      setPicked((n) => n + step);
      setPending((current) => new Set(current).add(person.id));
      try {
        await api("follow/" + person.id, { method: next ? "PUT" : "DELETE" });
        onFollowed(person, next);
      } catch (cause) {
        patch(person.id, next ? 0 : 1);
        setPicked((n) => n - step);
        toast.error(errorMessage(cause));
      } finally {
        setPending((current) => {
          const rest = new Set(current);
          rest.delete(person.id);
          return rest;
        });
      }
    },
    [onFollowed, patch, pending],
  );

  // The server checks the count again, so a stale screen cannot sneak past it.
  const finish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await api("onboarding/done", { method: "POST", body: {} });
      onDone();
    } catch (cause) {
      toast.error(errorMessage(cause));
      setFinishing(false);
    }
  }, [finishing, onDone]);

  const description =
    required > 0
      ? "Pick at least " +
        required +
        " to fill your Following feed. The Assbook crew is a good start."
      : "A Following feed is a lot more fun with company in it.";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (open || locked || finishing) return;
        onSkip();
      }}
    >
      <DialogContent className="assbook-dialog" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Follow a few backsides.</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="form-stack">
          {error ? (
            <div className="form-error" role="alert">
              <p>{error}</p>
              <button
                className="quiet"
                onClick={() => {
                  setError("");
                  setLoaded(false);
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
              up the good ones…
            </p>
          ) : people.length === 0 ? (
            <p className="muted">
              Nobody to follow yet. You are early. Come back soon.
            </p>
          ) : (
            <div className="onboard-list">
              {people.map((person) => (
                <div className="onboard-person" key={person.id}>
                  <PersonRow
                    person={person}
                    action={
                      <FollowButton
                        person={person}
                        pending={pending.has(person.id)}
                        onFollow={(target) => void follow(target)}
                      />
                    }
                  />
                  {person.bio && <p className="onboard-bio">{person.bio}</p>}
                </div>
              ))}
            </div>
          )}
          {!error && loaded && required > 0 && (
            <p className="onboard-progress" id={PROGRESS_ID} role="status">
              {followed} of {required} followed
            </p>
          )}
          <button
            className="primary"
            onClick={() => void finish()}
            disabled={!loaded || !!error || !enough || finishing}
            aria-describedby={
              loaded && !error && required > 0 ? PROGRESS_ID : undefined
            }
          >
            {finishing ? (
              <>
                <Loader2 className="spin" size={16} aria-hidden="true" /> Off we
                go…
              </>
            ) : (
              <>Let&rsquo;s go</>
            )}
          </button>
          <button className="onboard-skip" onClick={onSkip}>
            Skip for now
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
