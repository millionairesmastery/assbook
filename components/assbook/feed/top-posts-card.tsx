"use client";
import { Heart } from "lucide-react";
import { Avatar } from "@/components/assbook/avatar";
import { plural } from "@/lib/format";
import type { Post } from "@/lib/types";

/** Rail card: the most liked posts of the last 30 days. */
export function TopPostsCard({
  posts,
  onOpenPost,
}: {
  posts: Post[];
  onOpenPost: (id: string) => void;
}) {
  if (posts.length === 0) return null;
  return (
    <section className="top-posts card">
      <div className="eyebrow">BEHIND OF THE MONTH</div>
      <h2>Bums of the month</h2>
      <p className="small muted">Most liked in the last 30 days.</p>
      <ul>
        {posts.slice(0, 5).map((post) => (
          <li key={post.id}>
            <button
              className="top-post"
              onClick={() => onOpenPost(post.id)}
              aria-label={
                "Open the post by " +
                post.name +
                " with " +
                post.likes +
                " " +
                plural(post.likes, "like", "likes")
              }
            >
              {post.image ? (
                <img
                  className="top-thumb"
                  src={post.image}
                  alt=""
                  width={44}
                  height={44}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <Avatar person={post} />
              )}
              <span className="top-post-name">{post.name}</span>
              <span className="top-post-likes">
                <Heart size={14} fill="currentColor" aria-hidden="true" />
                {post.likes}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
