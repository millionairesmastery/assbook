"use client";
import { ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCard } from "@/components/assbook/feed/post-card";
import { EmptyState } from "@/components/assbook/feed/empty-state";
import { viewName } from "@/components/assbook/nav-items";
import { plural } from "@/lib/format";
import type { Post, Profile } from "@/lib/types";

export type FeedProps = {
  posts: Post[];
  loading: boolean;
  updating: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string;
  onRetry: () => void;
  onLoadMore: () => void;
  view: string;
  query: string;
  viewer: Profile | null;
  now: number;
  pending: ReadonlySet<string>;
  singlePostId: string;
  otherHandle: string;
  onExitSinglePost: () => void;
  onChooseView: (view: string) => void;
  onCompose: () => void;
  onFindPeople: () => void;
  onLike: (post: Post) => void;
  onSave: (post: Post) => void;
  onReplies: (post: Post) => void;
  onShare: (post: Post) => void;
  onVisitProfile: (handle: string) => void;
  onDelete: (post: Post) => void;
  onReport: (post: Post) => void;
  onBlock: (post: Post) => void;
};

export function Feed({
  posts,
  loading,
  updating,
  loadingMore,
  hasMore,
  error,
  onRetry,
  onLoadMore,
  view,
  query,
  viewer,
  now,
  pending,
  singlePostId,
  otherHandle,
  onExitSinglePost,
  onChooseView,
  onCompose,
  onFindPeople,
  onLike,
  onSave,
  onReplies,
  onShare,
  onVisitProfile,
  onDelete,
  onReport,
  onBlock,
}: FeedProps) {
  const label = query
    ? "SEARCH RESULTS"
    : view === "saved"
      ? "SAVED FOR LATER"
      : view === "profile"
        ? "THEIR POSTS ↓"
        : "THE LATEST ↓";

  const announcement =
    query && !loading && !error
      ? posts.length +
        " " +
        plural(posts.length, "post", "posts") +
        " for " +
        query
      : "";

  return (
    <>
      {singlePostId && (
        <div className="single-post-banner">
          <span>Viewing one post.</span>
          <button className="text-link" onClick={onExitSinglePost}>
            Back to the feed <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="feed-toolbar">
        <Tabs value={view} onValueChange={onChooseView}>
          <TabsList variant="line" aria-label={"Viewing: " + viewName(view)}>
            <TabsTrigger value="everyone">Everyone</TabsTrigger>
            <TabsTrigger value="following">Following</TabsTrigger>
          </TabsList>
        </Tabs>
        <span>
          {updating && <span className="updating-note">Updating…</span>}
          {label}
        </span>
      </div>
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
      {posts.some((post) => post.demo) && (
        <div className="sample-label">
          Sample profiles are labeled. Be the first real one.
        </div>
      )}
      {loading ? (
        <div className="state-card" role="status">
          <Loader2 className="spin" size={22} aria-hidden="true" />
          Getting the bottom of things…
        </div>
      ) : error ? (
        <div className="state-card" role="alert">
          <p>{error}</p>
          <button className="quiet" onClick={onRetry}>
            <RefreshCw size={16} aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          view={view}
          query={query}
          otherHandle={otherHandle}
          onCompose={onCompose}
          onFindPeople={onFindPeople}
        />
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            viewer={viewer}
            now={now}
            likePending={pending.has("like:" + post.id)}
            savePending={pending.has("save:" + post.id)}
            onLike={onLike}
            onSave={onSave}
            onReplies={onReplies}
            onShare={onShare}
            onVisitProfile={onVisitProfile}
            onDelete={onDelete}
            onReport={onReport}
            onBlock={onBlock}
          />
        ))
      )}
      {!loading && !error && hasMore && (
        <button className="load-more" disabled={loadingMore} onClick={onLoadMore}>
          {loadingMore ? (
            <>
              <Loader2 className="spin" size={16} aria-hidden="true" />
              Digging deeper…
            </>
          ) : (
            <>
              A little further down <ArrowRight size={16} aria-hidden="true" />
            </>
          )}
        </button>
      )}
    </>
  );
}
