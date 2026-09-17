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
  },
  (t) => [
    index("posts_created").on(t.created),
    index("posts_user").on(t.userId, t.created),
    index("posts_image").on(t.image),
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
