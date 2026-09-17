"use client";
import { Loader2, RefreshCw } from "lucide-react";
import { FollowButton, PersonRow } from "@/components/assbook/people/person-row";
import type { Profile } from "@/lib/types";

/** The community, in the main column where the feed usually lives. */
export function PeopleView({
  people,
  loading,
  error,
  onRetry,
  onVisit,
  onFollow,
  pending,
}: {
  people: Profile[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onVisit: (handle: string) => void;
  onFollow: (person: Profile) => void;
  pending: ReadonlySet<string>;
}) {
  return (
    <section className="people-view" aria-label="Community">
      <div className="feed-toolbar">
        <h2>Community</h2>
        <span>EVERYONE HERE ↓</span>
      </div>
      {error ? (
        <div className="state-card" role="alert">
          <p>{error}</p>
          <button className="quiet" onClick={onRetry}>
            <RefreshCw size={16} aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="state-card" role="status">
          <Loader2 className="spin" size={22} aria-hidden="true" />
          Rounding people up…
        </div>
      ) : people.length === 0 ? (
        <div className="state-card empty-card">
          <span aria-hidden="true">👖</span>
          <h2>Quiet back here.</h2>
          <p>
            You are the first one in. Invite a friend and give them something to
            follow.
          </p>
        </div>
      ) : (
        <div className="people-list card">
          {people.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              onVisit={onVisit}
              action={
                <FollowButton
                  person={person}
                  pending={pending.has("follow:" + person.id)}
                  onFollow={onFollow}
                />
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
