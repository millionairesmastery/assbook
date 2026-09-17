"use client";
import { memo } from "react";
import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";
import { Avatar } from "@/components/assbook/avatar";
import { PostMenu } from "@/components/assbook/feed/post-menu";
import { age } from "@/lib/format";
import type { Post, Profile } from "@/lib/types";

export type PostCardProps = {
  post: Post;
  viewer: Profile | null;
  now: number;
  likePending: boolean;
  savePending: boolean;
  onLike: (post: Post) => void;
  onSave: (post: Post) => void;
  onReplies: (post: Post) => void;
  onShare: (post: Post) => void;
  onVisitProfile: (handle: string) => void;
  onDelete: (post: Post) => void;
  onReport: (post: Post) => void;
  onBlock: (post: Post) => void;
};

export const PostCard = memo(function PostCard({
  post,
  viewer,
  now,
  likePending,
  savePending,
  onLike,
  onSave,
  onReplies,
  onShare,
  onVisitProfile,
  onDelete,
  onReport,
  onBlock,
}: PostCardProps) {
  const isOwn = viewer?.id === post.user_id;
  return (
    <article className="post card" id={"post-" + post.id}>
      <div className="post-head">
        <button
          onClick={() => onVisitProfile(post.handle)}
          aria-label={"View " + post.name}
        >
          <Avatar person={post} />
        </button>
        <button
          className="person-name"
          onClick={() => onVisitProfile(post.handle)}
        >
          <b>
            {post.name}
            {post.demo === 1 && <span className="tiny-badge">SAMPLE</span>}
          </b>
          <span className="person-meta">
            @{post.handle} · {age(post.created, now)}
          </span>
        </button>
        <button
          disabled={savePending}
          className={"icon-button " + (post.saved ? "selected" : "")}
          onClick={() => onSave(post)}
          aria-label={(post.saved ? "Unsave" : "Save") + " post by " + post.name}
          aria-pressed={!!post.saved}
        >
          <Bookmark
            size={19}
            fill={post.saved ? "currentColor" : "none"}
            aria-hidden="true"
          />
        </button>
        <PostMenu
          post={post}
          isOwn={isOwn}
          onDelete={onDelete}
          onReport={onReport}
          onBlock={onBlock}
        />
      </div>
      <p className="post-text">{post.body}</p>
      {post.image && (
        <img
          className="post-photo"
          src={post.image}
          alt={
            post.demo
              ? "Three fully clothed friends in jeans against a blue wall"
              : "Photo shared by " + post.name
          }
          loading="lazy"
          decoding="async"
        />
      )}
      <div className="post-actions">
        <button
          disabled={likePending}
          className={post.liked ? "selected" : ""}
          aria-pressed={!!post.liked}
          aria-label={(post.liked ? "Unlike" : "Like") + " post by " + post.name}
          onClick={() => onLike(post)}
        >
          <Heart
            size={19}
            fill={post.liked ? "currentColor" : "none"}
            aria-hidden="true"
          />
          {post.likes || "Like"}
        </button>
        <button
          onClick={() => onReplies(post)}
          aria-label={"Replies to post by " + post.name}
        >
          <MessageCircle size={19} aria-hidden="true" />
          {post.comments || "Reply"}
        </button>
        <button
          onClick={() => onShare(post)}
          aria-label={"Share post by " + post.name}
        >
          <Send size={18} aria-hidden="true" />
          Share
        </button>
        <span>
          {post.demo
            ? "Just a little inspiration."
            : "Pants on. Personality out."}
        </span>
      </div>
    </article>
  );
});
