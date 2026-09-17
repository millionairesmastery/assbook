import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text().primaryKey(),
  handle: text().notNull().unique(),
  name: text().notNull(),
  bio: text().notNull().default(""),
  avatar: text(),
  password: text(),
  salt: text(),
  demo: integer().notNull().default(0),
  created: integer().notNull(),
  email: text().unique(),
  authVersion: integer("auth_version").notNull().default(0),
  // Display names change at most once every 14 days.
  nameChangedAt: integer("name_changed_at"),
  // Optional website shown on the profile. Always an http(s) URL.
  link: text(),
  // 1 once the new-member step (follow a few people) is complete.
  onboarded: integer().notNull().default(0),
  // 1 once the member has seen the pinned welcome at the top of their feed.
  welcomed: integer().notNull().default(0),
  // "user" or "business" once the moderator has verified the account.
  verified: text(),
}, (t) => [index("users_avatar").on(t.avatar)]);
export const sessions = sqliteTable(
  "sessions",
  {
    token: text().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: integer().notNull(),
    authVersion: integer("auth_version").notNull().default(0),
  },
  (t) => [
    index("sessions_expiry").on(t.expires),
    index("sessions_user").on(t.userId, t.authVersion),
  ],
);
export const posts = sqliteTable(
  "posts",
  {
    id: text().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text().notNull(),
    image: text(),
    created: integer().notNull(),
    deleted: integer().notNull().default(0),
    // Pinned posts sit at the top of the main feed. Only the moderator pins.
    pinned: integer().notNull().default(0),
    // Set when the author edits the text (allowed for 15 minutes after posting).
    editedAt: integer("edited_at"),
  },
  (t) => [
    index("posts_created").on(t.created),
    index("posts_user").on(t.userId, t.created),
    index("posts_image").on(t.image),
    index("posts_pinned").on(t.pinned, t.created),
  ],
);
export const comments = sqliteTable(
  "comments",
  {
    id: text().primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text().notNull(),
    created: integer().notNull(),
  },
  (t) => [index("comments_post").on(t.postId, t.created)],
);
export const likes = sqliteTable(
  "likes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.postId] }),
    index("likes_post").on(t.postId),
  ],
);
export const bookmarks = sqliteTable(
  "bookmarks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] })],
);
export const follows = sqliteTable(
  "follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetId: text("target_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.targetId] }),
    index("follows_target").on(t.targetId),
  ],
);
export const blocks = sqliteTable(
  "blocks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetId: text("target_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.targetId] }),
    index("blocks_target").on(t.targetId),
  ],
);
export const uploads = sqliteTable(
  "uploads",
  {
    id: text().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    created: integer().notNull(),
    // What the photo was uploaded for: "post" or "avatar".
    target: text().notNull().default("post"),
    // 1 when the automatic check was unsure and a moderator should look.
    flagged: integer().notNull().default(0),
    flagReason: text("flag_reason"),
  },
  (t) => [index("uploads_flagged").on(t.flagged, t.created)],
);
export const reports = sqliteTable(
  "reports",
  {
    id: text().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    reason: text().notNull(),
    created: integer().notNull(),
    resolved: integer().notNull().default(0),
  },
  (t) => [
    uniqueIndex("reports_unique").on(t.userId, t.postId),
    index("reports_post").on(t.postId),
    index("reports_open").on(t.resolved, t.created),
  ],
);
export const limits = sqliteTable(
  "limits",
  {
    key: text().primaryKey(),
    count: integer().notNull(),
    expires: integer().notNull(),
  },
  (t) => [index("limits_expiry").on(t.expires)],
);

export const authTokens = sqliteTable("auth_tokens", {
  token: text().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: text().notNull(),
  purpose: text().notNull(),
  authVersion: integer("auth_version").notNull(),
  expires: integer().notNull(),
}, (t) => [index("auth_tokens_user").on(t.userId, t.purpose), index("auth_tokens_expiry").on(t.expires)]);

// Peeks: five-second clips that live for a day. The file goes, the record and
// its numbers stay.
export const peeks = sqliteTable(
  "peeks",
  {
    id: text().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    caption: text().notNull().default(""),
    contentType: text("content_type").notNull(),
    bytes: integer().notNull(),
    // The frame that went through the dress-code check; also the poster.
    frame: text().notNull(),
    created: integer().notNull(),
    expires: integer().notNull(),
    // 1 once the clip has been removed from storage after expiry.
    fileGone: integer("file_gone").notNull().default(0),
    deleted: integer().notNull().default(0),
  },
  (t) => [index("peeks_user").on(t.userId, t.created), index("peeks_live").on(t.deleted, t.expires)],
);
export const peekViews = sqliteTable(
  "peek_views",
  {
    peekId: text("peek_id")
      .notNull()
      .references(() => peeks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    created: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.peekId, t.userId] }), index("peek_views_user").on(t.userId)],
);
export const peekLikes = sqliteTable(
  "peek_likes",
  {
    peekId: text("peek_id")
      .notNull()
      .references(() => peeks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.peekId, t.userId] })],
);
export const peekReplies = sqliteTable(
  "peek_replies",
  {
    id: text().primaryKey(),
    peekId: text("peek_id")
      .notNull()
      .references(() => peeks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text().notNull(),
    created: integer().notNull(),
  },
  (t) => [index("peek_replies_peek").on(t.peekId, t.created)],
);
// A re-peek points at the original clip; nothing is copied. It lives as long
// as the original and keeps its own count of views it brought in.
export const peekShares = sqliteTable(
  "peek_shares",
  {
    peekId: text("peek_id")
      .notNull()
      .references(() => peeks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    created: integer().notNull(),
    views: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.peekId, t.userId] }), index("peek_shares_user").on(t.userId, t.created)],
);

// One row per thing that happened to a member: a follow, a like, a reply, a
// re-peek, or a note from the Assbook crew. Written when the event happens,
// read from the bell. The unique key keeps an unlike-relike from writing twice.
export const notifications = sqliteTable(
  "notifications",
  {
    id: text().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Who did it; empty for a note from the crew.
    actorId: text("actor_id").references(() => users.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    // Empty rather than null, so the unique key below can see them.
    postId: text("post_id").notNull().default(""),
    peekId: text("peek_id").notNull().default(""),
    // The reply or comment this is about; empty for a like or a follow.
    ref: text().notNull().default(""),
    // The words of a note, or a snippet of the reply.
    body: text().notNull().default(""),
    created: integer().notNull(),
    readAt: integer("read_at"),
  },
  (t) => [
    index("notifications_user").on(t.userId, t.created),
    uniqueIndex("notifications_once").on(t.userId, t.actorId, t.kind, t.postId, t.peekId, t.ref),
  ],
);
