"use client";
import { Loader2, RefreshCw } from "lucide-react";
import { Avatar } from "@/components/assbook/avatar";
import type { Profile } from "@/lib/types";

export function ProfileCard({
  profile,
  viewer,
  loading,
  error,
  onRetry,
  onEdit,
  onFollow,
  followPending,
}: {
  profile: Profile | null;
  viewer: Profile | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onEdit: () => void;
  onFollow: (person: Profile) => void;
  followPending: boolean;
}) {
  if (error)
    return (
      <div className="state-card" role="alert">
        <p>{error}</p>
        <button className="quiet" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden="true" />
          Try again
        </button>
      </div>
    );

  if (loading)
    return (
      <div className="state-card" role="status">
        <Loader2 className="spin" size={20} aria-hidden="true" />
        Finding that profile…
      </div>
    );

  if (!profile) return null;

  const isMe = viewer?.id === profile.id;
  return (
    <section className="profile-card card">
      <Avatar person={profile} large />
      <div>
        <h2>{profile.name}</h2>
        <p className="muted">
          @{profile.handle}
          {profile.demo ? " · Sample profile" : ""}
        </p>
        <p>{profile.bio || "Still finding the right words."}</p>
        <p className="small">{profile.followers ?? 0} followers</p>
      </div>
      {isMe ? (
        <button className="follow-button" onClick={onEdit}>
          Edit profile
        </button>
      ) : (
        <button
          className={"follow-button " + (profile.following ? "is-following" : "")}
          disabled={followPending}
          onClick={() => onFollow(profile)}
          aria-label={
            (profile.following ? "Unfollow " : "Follow ") + profile.name
          }
        >
          {profile.following ? "Following" : "Follow"}
        </button>
      )}
    </section>
  );
}
