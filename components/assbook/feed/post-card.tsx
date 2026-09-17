"use client";
import { memo } from "react";
import { Bookmark, Heart, MessageCircle, Pin, Send } from "lucide-react";
import { Avatar } from "@/components/assbook/avatar";
import { OfficialBadge } from "@/components/assbook/official-badge";
import { PostMenu } from "@/components/assbook/feed/post-menu";
import { age } from "@/lib/format";
import type { Post, Profile } from "@/lib/types";

export type PostCardProps = {
  post: Post;
  viewer: Profile | null;
  now: number;
  likePending: boolean;
  savePending: boolean;
  pinPending: boolean;
  onLike: (post: Post) => void;
  onSave: (post: Post) => void;
  onReplies: (post: Post) => void;
  onShare: (post: Post) => void;
  onVisitProfile: (handle: string) => void;
  onDelete: (post: Post) => void;
  onReport: (post: Post) => void;
  onBlock: (post: Post) => void;
  onPin: (post: Post) => void;
};

export const PostCard = memo(function PostCard({
  post,
  viewer,
  now,
  likePending,
  savePending,
  pinPending,
  onLike,
  onSave,
  onReplies,
  onShare,
  onVisitProfile,
  onDelete,
  onReport,
  onBlock,
  onPin,
}: PostCardProps) {
  const isOwn = viewer?.id === post.user_id;
  return (
    <article className="post card" id={"post-" + post.id}>
      {post.pinned === 1 && (
        <p className="pinned-label">
          <Pin size={13} aria-hidden="true" />
          Pinned
        </p>
      )}
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
            {post.official === 1 && <OfficialBadge />}
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
          canPin={!!viewer?.isAdmin}
          pinPending={pinPending}
          onDelete={onDelete}
          onReport={onReport}
          onBlock={onBlock}
          onPin={onPin}
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
