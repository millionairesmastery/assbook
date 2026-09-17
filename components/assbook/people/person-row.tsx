"use client";
import type { ReactNode } from "react";
import { Check, Plus } from "lucide-react";
import { Avatar } from "@/components/assbook/avatar";
import { OfficialBadge } from "@/components/assbook/official-badge";
import type { Profile } from "@/lib/types";

/** One row in the rail, the community dialog and the blocked list. */
export function PersonRow({
  person,
  onVisit,
  action,
}: {
  person: Profile;
  onVisit?: (handle: string) => void;
  action?: ReactNode;
}) {
  const identity = (
    <>
      <b className="name-line">
        <span className="name-text">{person.name}</span>
        {person.official === 1 && <OfficialBadge />}
      </b>
      <span className="person-meta">@{person.handle}</span>
    </>
  );
  return (
    <div className="person">
      {onVisit ? (
        <button
          onClick={() => onVisit(person.handle)}
          aria-label={"View " + person.name}
        >
          <Avatar person={person} />
        </button>
      ) : (
        <Avatar person={person} />
      )}
      {onVisit ? (
        <button className="person-name" onClick={() => onVisit(person.handle)}>
          {identity}
        </button>
      ) : (
        <div className="person-name">{identity}</div>
      )}
      {action}
    </div>
  );
}

export function FollowButton({
  person,
  pending,
  onFollow,
}: {
  person: Profile;
  pending: boolean;
  onFollow: (person: Profile) => void;
}) {
  return (
    <button
      disabled={pending}
      className={"follow-button " + (person.following ? "is-following" : "")}
      onClick={() => onFollow(person)}
      aria-label={(person.following ? "Unfollow " : "Follow ") + person.name}
    >
      {person.following ? (
        <Check size={16} aria-hidden="true" />
      ) : (
        <Plus size={16} aria-hidden="true" />
      )}
      <span>{person.following ? "Following" : "Follow"}</span>
    </button>
  );
}
