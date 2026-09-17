"use client";
import {
  CalendarDays,
  Link as LinkIcon,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar } from "@/components/assbook/avatar";
import { NameBadge } from "@/components/assbook/account-badge";
import { joined, linkLabel, plural, webLink } from "@/lib/format";
import type { Profile } from "@/lib/types";

export function ProfileCard({
  profile,
  viewer,
  loading,
  error,
  onRetry,
  onEdit,
  onOpenSecurity,
  onOpenFollowers,
  onOpenFollowing,
  tab,
  onTab,
  onFollow,
  followPending,
  onOpenPeek,
  onOpenPhoto,
}: {
  profile: Profile | null;
  viewer: Profile | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onEdit: () => void;
  onOpenSecurity: () => void;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
  /** "posts" or "saved", on your own profile only. */
  tab: string;
  onTab: (tab: string) => void;
  onFollow: (person: Profile) => void;
  followPending: boolean;
  /** Opens their peeks. Only offered when they have one running. */
  onOpenPeek?: (personId: string) => void;
  onOpenPhoto?: (src: string, alt: string) => void;
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
  const link = webLink(profile.link);
  const posts = profile.posts_count ?? 0;
  const followers = profile.followers ?? 0;
  const following = profile.following_count ?? 0;

  return (
    <section className="profile-header card">
      <div className="profile-top">
        {viewer && profile.has_peek === 1 && onOpenPeek ? (
          <button
            className="profile-peek"
            onClick={() => onOpenPeek(profile.id)}
            aria-label={"Watch " + profile.name + "’s peeks"}
          >
            <Avatar person={profile} large ring="fresh" />
          </button>
        ) : profile.avatar && onOpenPhoto ? (
          <button
            className="profile-photo-button"
            onClick={() => onOpenPhoto(profile.avatar!, profile.name + "’s profile photo")}
            aria-label={"View " + profile.name + "’s profile photo large"}
          >
            <Avatar person={profile} large />
          </button>
        ) : (
          <Avatar person={profile} large />
        )}
        <div className="profile-identity">
          <h2 className="name-line">
            <span className="name-wrap">{profile.name}</span>
            <NameBadge person={profile} />
            {profile.demo === 1 && <span className="tiny-badge">SAMPLE</span>}
          </h2>
          <p className="person-meta">@{profile.handle}</p>
        </div>
        <div className="profile-actions">
          {isMe ? (
            <>
              <button className="follow-button" onClick={onEdit}>
                Edit profile
              </button>
              <button className="text-link" onClick={onOpenSecurity}>
                <ShieldCheck size={15} aria-hidden="true" />
                Account security
              </button>
            </>
          ) : (
            <button
              className={
                "follow-button " + (profile.following ? "is-following" : "")
              }
              disabled={followPending}
              onClick={() => onFollow(profile)}
              aria-label={
                (profile.following ? "Unfollow " : "Follow ") + profile.name
              }
            >
              {profile.following ? "Following" : "Follow"}
            </button>
          )}
        </div>
      </div>
      <p className="profile-bio">
        {profile.bio || "Still finding the right words."}
      </p>
      {link && (
        <p className="profile-link">
          <LinkIcon size={14} aria-hidden="true" />
          <a href={link} target="_blank" rel="noopener nofollow ugc">
            {linkLabel(link)}
          </a>
        </p>
      )}
      <p className="profile-joined">
        <CalendarDays size={14} aria-hidden="true" />
        {joined(profile.created)}
      </p>
      <div className="profile-stats">
        <div className="stat">
          <b>{posts}</b>
          <span>{plural(posts, "Post", "Posts")}</span>
        </div>
        <button
          className="stat"
          onClick={onOpenFollowers}
          aria-label={
            "Show the " +
            followers +
            " " +
            plural(followers, "follower", "followers") +
            " of " +
            profile.name
          }
        >
          <b>{followers}</b>
          <span>{plural(followers, "Follower", "Followers")}</span>
        </button>
        <button
          className="stat"
          onClick={onOpenFollowing}
          aria-label={
            "Show the " +
            following +
            " " +
            plural(following, "account", "accounts") +
            " " +
            profile.name +
            " follows"
          }
        >
          <b>{following}</b>
          <span>Following</span>
        </button>
      </div>
      {isMe ? (
        <Tabs className="profile-tabs" value={tab} onValueChange={onTab}>
          <TabsList variant="line" aria-label="Your posts and saved posts">
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="saved">Saved</TabsTrigger>
          </TabsList>
        </Tabs>
      ) : (
        <Tabs className="profile-tabs" value="posts">
          <TabsList variant="line" aria-label={"Posts by " + profile.name}>
            <TabsTrigger value="posts">Posts</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
    </section>
  );
}
