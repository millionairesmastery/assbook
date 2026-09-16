import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
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
});
export const sessions = sqliteTable(
  "sessions",
  {
    token: text().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: integer().notNull(),
  },
  (t) => [index("sessions_expiry").on(t.expires)],
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
  (t) => [primaryKey({ columns: [t.userId, t.targetId] })],
);
export const uploads = sqliteTable("uploads", {
  id: text().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  created: integer().notNull(),
});
export const reports = sqliteTable("reports", {
  id: text().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  reason: text().notNull(),
  created: integer().notNull(),
});
export const limits = sqliteTable(
  "limits",
  {
    key: text().primaryKey(),
    count: integer().notNull(),
    expires: integer().notNull(),
  },
  (t) => [index("limits_expiry").on(t.expires)],
);
