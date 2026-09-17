"use client";
import { ArrowUpRight, Loader2, RefreshCw } from "lucide-react";
import { FollowButton, PersonRow } from "@/components/assbook/people/person-row";
import type { Profile } from "@/lib/types";

export function PeopleRail({
  people,
  loading,
  error,
  onRetry,
  onVisit,
  onFollow,
  pending,
  onOpenAll,
}: {
  people: Profile[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onVisit: (handle: string) => void;
  onFollow: (person: Profile) => void;
  pending: ReadonlySet<string>;
  onOpenAll: () => void;
}) {
  return (
    <section className="people card">
      <div className="eyebrow">SMALL WORLD. GREAT JEANS.</div>
      <h2>
        People you’ve
        <br />
        fallen behind.
      </h2>
      {error ? (
        <div className="rail-state" role="alert">
          <p className="small">{error}</p>
          <button className="quiet" onClick={onRetry}>
            <RefreshCw size={15} aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="rail-state" role="status">
          <Loader2 className="spin" size={18} aria-hidden="true" />
          <span className="small">Rounding people up…</span>
        </div>
      ) : people.length === 0 ? (
        <p className="muted small">You’re the first one here. Invite a friend.</p>
      ) : (
        people
          .slice(0, 3)
          .map((person) => (
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
          ))
      )}
      <button className="text-link" onClick={onOpenAll}>
        Meet the community <ArrowUpRight size={14} aria-hidden="true" />
      </button>
    </section>
  );
}
