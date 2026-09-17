"use client";
import { ArrowRight } from "lucide-react";

export type EmptyStateProps = {
  view: string;
  query: string;
  /** Set when looking at somebody else's profile that has no posts. */
  otherHandle: string;
  onCompose: () => void;
  onFindPeople: () => void;
};

export function EmptyState({
  view,
  query,
  otherHandle,
  onCompose,
  onFindPeople,
}: EmptyStateProps) {
  const findPeople = view === "following" || !!otherHandle;
  let heading = "You’re early. We like that.";
  let blurb = "Drop the first post. Someone has to go first.";

  if (query) {
    heading = "Nobody back here.";
    blurb = "Try another name, handle, or phrase.";
  } else if (otherHandle) {
    heading = "@" + otherHandle + " hasn’t posted yet.";
    blurb = "Follow along and you will be there when they do.";
  } else if (view === "saved") {
    heading = "A little empty back here.";
    blurb = "Tap the bookmark on a post to save it here.";
  } else if (view === "following") {
    heading = "Find your kind of people.";
    blurb = "Follow a few people to bring their posts here.";
  } else if (view === "profile") {
    heading = "Your backside is blank.";
    blurb = "Drop your first post. It only gets easier from here.";
  }

  return (
    <div className="state-card empty-card">
      <span aria-hidden="true">🍑</span>
      <h2>{heading}</h2>
      <p>{blurb}</p>
      <button
        className="primary"
        onClick={findPeople ? onFindPeople : onCompose}
      >
        {findPeople ? "Meet the community" : "Write a post"}
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
