"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errorMessage, isAbortError } from "@/lib/api-client";
import type { FeedCursor, FeedResponse, Post } from "@/lib/types";

export type FeedParams = {
  view: string;
  query: string;
  profileTarget: string;
  singlePostId: string;
  viewerId: string;
  ready: boolean;
};

type FeedData = {
  key: string;
  posts: Post[];
  hasMore: boolean;
  next: FeedCursor | null;
};

function feedKey(p: FeedParams): string {
  return JSON.stringify([
    p.view,
    p.query,
    p.profileTarget,
    p.singlePostId,
    p.viewerId,
  ]);
}

function feedPath(
  view: string,
  query: string,
  profileTarget: string,
  singlePostId: string,
  cursor: FeedCursor | null,
): string {
  const search = new URLSearchParams();
  search.set("filter", view);
  if (query) search.set("q", query);
  if (profileTarget) search.set("profile", profileTarget);
  if (singlePostId) search.set("post", singlePostId);
  if (cursor) {
    search.set("before", String(cursor.created));
    search.set("beforeId", cursor.id);
  }
  return "feed?" + search.toString();
}

// Posts come back newest first (created DESC, id DESC).
function isOlder(post: Post, cursor: FeedCursor): boolean {
  return (
    post.created < cursor.created ||
    (post.created === cursor.created && post.id < cursor.id)
  );
}

/**
 * Keyset-paginated feed. The rendered list is only ever replaced by a finished
 * request, so a like, a new post or a block never blanks the page or throws
 * away pages somebody already scrolled through.
 */
export function useFeed(params: FeedParams) {
  const { view, query, profileTarget, singlePostId, ready } = params;
  const key = feedKey(params);
  const [data, setData] = useState<FeedData | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(
    null,
  );
  const [updating, setUpdating] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    api<FeedResponse>(feedPath(view, query, profileTarget, singlePostId, null), {
      signal: controller.signal,
    })
      .then((page) => {
        setData({
          key,
          posts: page.posts,
          hasMore: page.hasMore,
          next: page.next,
        });
        setFailure(null);
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setFailure({ key, message: errorMessage(cause) });
      });
    return () => controller.abort();
  }, [key, ready, attempt, view, query, profileTarget, singlePostId]);

  const matched = data && data.key === key ? data : null;
  const errored = failure && failure.key === key ? failure.message : "";
  const loading = !ready || (!matched && !errored);

  const retry = useCallback(() => {
    setFailure(null);
    setAttempt((n) => n + 1);
  }, []);

  // Background refresh: the list on screen stays put until the answer arrives.
  const revalidate = useCallback(() => {
    if (!ready) return;
    setUpdating(true);
    api<FeedResponse>(feedPath(view, query, profileTarget, singlePostId, null))
      .then((fresh) => {
        setData((current) => {
          const base: FeedData = {
            key,
            posts: fresh.posts,
            hasMore: fresh.hasMore,
            next: fresh.next,
          };
          const edge = fresh.next;
          if (!current || current.key !== key || !edge) return base;
          const seen = new Set(fresh.posts.map((p) => p.id));
          const tail = current.posts.filter(
            (p) => !seen.has(p.id) && isOlder(p, edge),
          );
          if (!tail.length) return base;
          return {
            key,
            posts: [...fresh.posts, ...tail],
            hasMore: current.hasMore,
            next: current.next,
          };
        });
        setFailure(null);
      })
      .catch((cause: unknown) => {
        if (!isAbortError(cause)) toast.error(errorMessage(cause));
      })
      .finally(() => setUpdating(false));
  }, [key, ready, view, query, profileTarget, singlePostId]);

  const loadMore = useCallback(() => {
    const cursor = matched?.next;
    if (loadingMore || !cursor || !matched?.hasMore) return;
    setLoadingMore(true);
    api<FeedResponse>(
      feedPath(view, query, profileTarget, singlePostId, cursor),
    )
      .then((page) => {
        setData((current) => {
          if (!current || current.key !== key) return current;
          const seen = new Set(current.posts.map((p) => p.id));
          return {
            ...current,
            posts: [
              ...current.posts,
              ...page.posts.filter((p) => !seen.has(p.id)),
            ],
            hasMore: page.hasMore,
            next: page.next,
          };
        });
      })
      .catch((cause: unknown) => {
        if (!isAbortError(cause)) toast.error(errorMessage(cause));
      })
      .finally(() => setLoadingMore(false));
  }, [key, loadingMore, matched, view, query, profileTarget, singlePostId]);

  const patchPost = useCallback((id: string, patch: Partial<Post>) => {
    setData((current) =>
      current
        ? {
            ...current,
            posts: current.posts.map((p) =>
              p.id === id ? { ...p, ...patch } : p,
            ),
          }
        : current,
    );
  }, []);

  const removePost = useCallback((id: string) => {
    setData((current) =>
      current
        ? { ...current, posts: current.posts.filter((p) => p.id !== id) }
        : current,
    );
  }, []);

  return {
    posts: matched?.posts ?? [],
    hasMore: matched?.hasMore ?? false,
    loading,
    updating,
    loadingMore,
    error: errored,
    retry,
    revalidate,
    loadMore,
    patchPost,
    removePost,
  };
}
