"use client";
import { Loader2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FollowButton, PersonRow } from "@/components/assbook/people/person-row";
import type { Profile } from "@/lib/types";

export function PeopleDialog({
  people,
  loading,
  error,
  onRetry,
  onVisit,
  onFollow,
  pending,
  onClose,
}: {
  people: Profile[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onVisit: (handle: string) => void;
  onFollow: (person: Profile) => void;
  pending: ReadonlySet<string>;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="assbook-dialog">
        <DialogHeader>
          <DialogTitle>People you’ve fallen behind.</DialogTitle>
          <DialogDescription>
            Find someone worth falling behind.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="form-error" role="alert">
            <p>{error}</p>
            <button className="quiet" onClick={onRetry}>
              <RefreshCw size={15} aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : loading ? (
          <p className="muted" role="status">
            <Loader2 className="spin" size={18} aria-hidden="true" /> Rounding
            people up…
          </p>
        ) : people.length === 0 ? (
          <p className="muted">You’re the first one here. Invite a friend.</p>
        ) : (
          people
            .slice(0, 20)
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
      </DialogContent>
    </Dialog>
  );
}
