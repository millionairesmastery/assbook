export type Profile = {
  id: string;
  handle: string;
  name: string;
  bio: string;
  avatar: string | null;
  link?: string | null;
  demo: number;
  created: number;
  following?: number;
  followers?: number;
  following_count?: number;
  posts_count?: number;
  official?: number;
  verified?: "user" | "business" | null;
  has_peek?: number;
  isAdmin?: boolean;
  nameLockedUntil?: number | null;
  onboarded?: boolean;
};
export type Post = {
  id: string;
  user_id: string;
  body: string;
  image: string | null;
  created: number;
  pinned: number;
  edited_at: number | null;
  handle: string;
  name: string;
  avatar: string | null;
  demo: number;
  official: number;
  verified?: "user" | "business" | null;
  likes: number;
  comments: number;
  liked: number;
  saved: number;
};
export type FeedCursor = { created: number; id: string };
export type FeedResponse = {
  posts: Post[];
  hasMore: boolean;
  next: FeedCursor | null;
};
export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  /** The reply this one sits under, or null at the top level. */
  parent_id: string | null;
  body: string;
  created: number;
  likes: number;
  liked: number;
  handle: string;
  name: string;
  avatar: string | null;
  verified?: "user" | "business" | null;
  official?: number;
};
export type ReportGroup = {
  post_id: string;
  body: string;
  image: string | null;
  handle: string;
  count: number;
  latest: number;
  reasons: string;
};
export type FlaggedPhoto = {
  id: string;
  url: string;
  created: number;
  target: string;
  reason: string | null;
  handle: string;
  in_use: number;
};
export type Peek = {
  id: string;
  user_id?: string;
  caption: string;
  video: string;
  poster: string;
  created: number;
  expires: number;
  likes: number;
  replies: number;
  views: number;
  repeeks: number;
  liked: number;
  watched: number;
  repeeked: number;
  creator: { id: string; handle: string; name: string; avatar: string | null; official: number; verified?: "user" | "business" | null };
  // Set when this entry is somebody's re-peek of the creator's clip.
  shared_by: { id: string; handle: string; name: string; views: number } | null;
};
export type PeekPerson = {
  id: string;
  handle: string;
  name: string;
  avatar: string | null;
  official: number;
  following: number;
  unwatched: number;
  watched: boolean;
  peeks: Peek[];
};
export type PeekReply = {
  id: string;
  peek_id: string;
  user_id: string;
  body: string;
  created: number;
  handle: string;
  name: string;
  avatar: string | null;
};

export type NotificationKind =
  | "follow"
  | "like"
  | "comment"
  | "peek_like"
  | "peek_reply"
  | "repeek"
  | "mention"
  | "comment_like"
  | "comment_reply"
  | "note";
export type NotificationActor = {
  id: string;
  handle: string;
  name: string;
  avatar: string | null;
  verified: "user" | "business" | null;
  official: number;
};
export type Notification = {
  id: string;
  kind: NotificationKind;
  post_id: string;
  peek_id: string;
  body: string;
  created: number;
  read: boolean;
  post_live: boolean;
  peek_live: boolean;
  peek_user_id: string;
  /** Null for a note from the Assbook crew. */
  actor: NotificationActor | null;
};
