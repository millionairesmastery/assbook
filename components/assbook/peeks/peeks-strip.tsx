"use client";
import { Plus, RefreshCw } from "lucide-react";
import { Avatar } from "@/components/assbook/avatar";
import { NameBadge } from "@/components/assbook/account-badge";
import type { PeekPerson, Profile } from "@/lib/types";

/** "Sam Sitwell" becomes "Sam": the row has room for one word. */
function firstWord(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/**
 * The strip above the feed: your own clip first, then everybody else in the
 * order the server picked. Nothing here for a visitor, since there is no
 * camera control to offer them either.
 */
export function PeeksStrip({
  viewer,
  people,
  loading,
  error,
  onRetry,
  onOpenPerson,
  onPostPeek,
}: {
  viewer: Profile | null;
  people: PeekPerson[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onOpenPerson: (personId: string) => void;
  onPostPeek: () => void;
}) {
  if (!viewer) return null;
  const own = people.find((person) => person.id === viewer.id) ?? null;
  const others = people.filter((person) => person.id !== viewer.id);

  return (
    <section className="peeks-strip" aria-label="Peeks">
      <ul className="peeks-row">
        <li>
          <button
            className="peek-item"
            onClick={() => (own ? onOpenPerson(viewer.id) : onPostPeek())}
            aria-label={
              own ? "Watch your peek" : "Post a peek, five seconds of your day"
            }
          >
            <span className="peek-avatar">
              <Avatar
                person={viewer}
                round
                ring={own ? (own.watched ? "watched" : "fresh") : "empty"}
              />
              {!own && (
                <span className="peek-plus" aria-hidden="true">
                  <Plus size={13} strokeWidth={3} />
                </span>
              )}
            </span>
            <span className="peek-name">Your peek</span>
          </button>
        </li>
        {others.map((person) => (
          <li key={person.id}>
            <button
              className="peek-item"
              onClick={() => onOpenPerson(person.id)}
              aria-label={
                "Watch " +
                person.name +
                (person.watched ? "’s peeks, all watched" : "’s new peeks")
              }
            >
              <span className="peek-avatar">
                <Avatar
                  person={person}
                  round
                  ring={person.watched ? "watched" : "fresh"}
                />
              </span>
              <span className="peek-name">
                {firstWord(person.name)}
                <NameBadge person={person} focusable={false} />
              </span>
            </button>
          </li>
        ))}
        {loading &&
          others.length === 0 &&
          [0, 1, 2].map((slot) => (
            <li key={"waiting-" + slot} aria-hidden="true">
              <span className="peek-item">
                <span className="peek-avatar is-waiting" />
                <span className="peek-name" />
              </span>
            </li>
          ))}
      </ul>
      {error && (
        <button className="quiet peeks-retry" onClick={onRetry}>
          <RefreshCw size={14} aria-hidden="true" />
          Peeks did not load. Try again
        </button>
      )}
    </section>
  );
}
