"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/assbook/avatar";
import { OfficialBadge } from "@/components/assbook/official-badge";
import { FollowButton } from "@/components/assbook/people/person-row";
import { usePersonSearch } from "@/hooks/use-person-search";
import { api, errorMessage, isAbortError } from "@/lib/api-client";
import type { Profile } from "@/lib/types";

type Suggestions = { people: Profile[]; required: number; following: number };

const PROGRESS_ID = "onboarding-progress";

/**
 * The one step every new member goes through: follow a few people, so the
 * Following feed has something in it. Suggestions come first; the search box
 * finds anyone else. There is no way out except following enough people,
 * which the server checks again before it marks the member as done.
 */
export function FollowOnboardingDialog({
  selfId,
  onFollowed,
  onDone,
}: {
  selfId: string;
  onFollowed: (person: Profile, following: number) => void;
  onDone: () => void;
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
  const [term, setTerm] = useState("");
  // Follow state decided in this dialog, so a person looks the same whether
  // they came from the suggestions or from a search.
  const [decided, setDecided] = useState<ReadonlyMap<string, number>>(() => new Map());
  const search = usePersonSearch(term);

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

  const withState = useCallback(
    (person: Profile): Profile => {
      const following = decided.get(person.id);
      return following === undefined ? person : { ...person, following };
    },
    [decided],
  );

  const follow = useCallback(
    async (raw: Profile) => {
      const person = withState(raw);
      if (pending.has(person.id)) return;
      const next = person.following ? 0 : 1;
      const step = next ? 1 : -1;
      setDecided((current) => new Map(current).set(person.id, next));
      setPicked((n) => n + step);
      setPending((current) => new Set(current).add(person.id));
      try {
        await api("follow/" + person.id, { method: next ? "PUT" : "DELETE" });
        onFollowed(person, next);
      } catch (cause) {
        setDecided((current) => new Map(current).set(person.id, next ? 0 : 1));
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
    [onFollowed, pending, withState],
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

  const searching = term.trim().length > 0;
  // A search can turn up the member themselves; nobody needs to follow that.
  const shown = (searching ? search.people : people)
    .filter((person) => person.id !== selfId)
    .map(withState);
  const description =
    required > 0
      ? "Pick at least " + required + " to fill your Following feed. The Assbook crew is a good start."
      : "A Following feed is a lot more fun with company in it.";

  return (
    <Dialog
      open
      onOpenChange={() => {
        // Following enough people is the only way through.
      }}
    >
      <DialogContent className="assbook-dialog onboard-dialog" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Follow a few backsides.</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="form-stack onboard-stack">
          <div className="onboard-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Find someone by name or handle"
              aria-label="Find people to follow"
              autoComplete="off"
              maxLength={40}
            />
          </div>
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
            <p className="muted small" role="status">
              <Loader2 className="spin" size={16} aria-hidden="true" /> Rounding up the good ones…
            </p>
          ) : shown.length === 0 ? (
            <p className="muted small">
              {searching
                ? search.searched
                  ? "No one by that name yet."
                  : "Looking…"
                : "Nobody to follow yet. You are early. Come back soon."}
            </p>
          ) : (
            <ul className="onboard-list" aria-label={searching ? "Search results" : "Suggested people"}>
              {shown.map((person) => (
                <li className="onboard-row" key={person.id}>
                  <Avatar person={person} />
                  <div className="onboard-who">
                    <b className="name-line">
                      <span className="name-text">{person.name}</span>
                      {person.official === 1 && <OfficialBadge />}
                    </b>
                    <span className="onboard-meta">
                      @{person.handle}
                      {person.bio ? " · " + person.bio : ""}
                    </span>
                  </div>
                  <FollowButton
                    person={person}
                    pending={pending.has(person.id)}
                    onFollow={(target) => void follow(target)}
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="onboard-footer">
            {!error && loaded && required > 0 && (
              <p className="onboard-progress" id={PROGRESS_ID} role="status">
                {followed} of {required} followed
              </p>
            )}
            <button
              className="primary"
              onClick={() => void finish()}
              disabled={!loaded || !!error || !enough || finishing}
              aria-describedby={loaded && !error && required > 0 ? PROGRESS_ID : undefined}
            >
              {finishing ? (
                <>
                  <Loader2 className="spin" size={16} aria-hidden="true" /> Off we go…
                </>
              ) : (
                <>Let&rsquo;s go</>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
