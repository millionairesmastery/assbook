"use client";
import { useEffect, useState } from "react";
import { api, isAbortError } from "@/lib/api-client";
import type { Post } from "@/lib/types";

/**
 * Bums of the month: the most liked posts of the last 30 days. A quiet extra in
 * the rail, so a failure just hides the card instead of shouting about it.
 */
export function useTopPosts(viewerId: string, ready: boolean) {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    api<{ posts: Post[] }>("top", { signal: controller.signal })
      .then((data) => setPosts(data.posts))
      .catch((cause: unknown) => {
        if (!isAbortError(cause)) setPosts([]);
      });
    return () => controller.abort();
  }, [viewerId, ready]);

  return posts;
}
