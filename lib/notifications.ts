import { db, HttpError, adminHandle } from "./server";

// In-app notifications. A row is written when something happens to a member
// and read back from the bell. Nothing here may break the action that caused
// it: a like still lands if the notification does not.

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

type NotifyInput = {
  to: string;
  actor?: string | null;
  kind: NotificationKind;
  postId?: string;
  peekId?: string;
  ref?: string;
  body?: string;
};

const KEEP_MS = 60 * 86400000;
const PAGE = 50;

// Replies and notes carry a few words; enough to know what it was about.
function snippet(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 90 ? flat.slice(0, 89).trimEnd() + "…" : flat;
}

export async function notify(input: NotifyInput): Promise<void> {
  if (input.actor && input.actor === input.to) return;
  try {
    await db()
      .prepare(
        "INSERT OR IGNORE INTO notifications(id,user_id,actor_id,kind,post_id,peek_id,ref,body,created) VALUES(?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        crypto.randomUUID(),
        input.to,
        input.actor ?? null,
        input.kind,
        input.postId ?? "",
        input.peekId ?? "",
        input.ref ?? "",
        snippet(input.body ?? ""),
        Date.now(),
      )
      .run();
  } catch (e) {
    console.error(
      JSON.stringify({
        event: "notify_failed",
        kind: input.kind,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
  }
}

// @handles in a text: a word of 3 to 24 handle characters after an @ that
// does not sit inside another word or address. Ten at most per text.
const MENTION = /(?:^|[^a-z0-9_@])@([a-z0-9_]{3,24})(?![a-z0-9_])/gi;
export function mentionedHandles(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(MENTION)) {
    found.add(match[1].toLowerCase());
    if (found.size >= 10) break;
  }
  return [...found];
}

// Tells everyone named in a text, unless they are the author, already told
// another way (the post owner, the reply's author), or blocked either way.
export async function notifyMentions(input: {
  text: string;
  actor: string;
  postId?: string;
  peekId?: string;
  ref?: string;
  skip?: (string | null | undefined)[];
}): Promise<void> {
  const handles = mentionedHandles(input.text);
  if (!handles.length) return;
  const skip = new Set([input.actor, ...(input.skip ?? []).filter(Boolean)]);
  try {
    const rows = await db()
      .prepare(
        "SELECT u.id FROM users u WHERE u.handle IN (" +
          handles.map(() => "?").join(",") +
          ") AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.target_id=u.id) OR (b.user_id=u.id AND b.target_id=?))",
      )
      .bind(...handles, input.actor, input.actor)
      .all<{ id: string }>();
    for (const row of rows.results) {
      if (skip.has(row.id)) continue;
      await notify({
        to: row.id,
        actor: input.actor,
        kind: "mention",
        postId: input.postId,
        peekId: input.peekId,
        ref: input.ref,
        body: input.text,
      });
    }
  } catch (e) {
    console.error(
      JSON.stringify({ event: "mention_failed", error: e instanceof Error ? e.message : String(e) }),
    );
  }
}

export async function unreadCount(uid: string): Promise<number> {
  const row = await db()
    .prepare("SELECT count(*) n FROM notifications WHERE user_id=? AND read_at IS NULL")
    .bind(uid)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function purgeOldNotifications(): Promise<void> {
  await db()
    .prepare("DELETE FROM notifications WHERE created<?")
    .bind(Date.now() - KEEP_MS)
    .run();
}

type Row = {
  id: string;
  kind: NotificationKind;
  post_id: string;
  peek_id: string;
  body: string;
  created: number;
  read_at: number | null;
  actor_id: string | null;
  handle: string | null;
  name: string | null;
  avatar: string | null;
  verified: "user" | "business" | null;
  post_live: number;
  peek_user_id: string | null;
  peek_live: number;
};

export async function notificationsRoute(
  path: string[],
  method: string,
  uid: string,
): Promise<Response> {
  if (path.length === 1 && method === "GET") {
    const admin = adminHandle();
    const now = Date.now();
    const rows = await db()
      .prepare(
        "SELECT n.id,n.kind,n.post_id,n.peek_id,n.body,n.created,n.read_at,n.actor_id,u.handle,u.name,u.avatar,u.verified," +
          " EXISTS(SELECT 1 FROM posts p WHERE p.id=n.post_id AND p.deleted=0) post_live," +
          " k.user_id peek_user_id, (k.id IS NOT NULL AND k.expires>?) peek_live" +
          " FROM notifications n LEFT JOIN users u ON u.id=n.actor_id LEFT JOIN peeks k ON k.id=n.peek_id" +
          " WHERE n.user_id=? ORDER BY n.created DESC LIMIT ?",
      )
      .bind(now, uid, PAGE)
      .all<Row>();
    const items = rows.results.map((r) => ({
      id: r.id,
      kind: r.kind,
      post_id: r.post_id,
      peek_id: r.peek_id,
      body: r.body,
      created: r.created,
      read: r.read_at !== null,
      post_live: !!r.post_live,
      peek_live: !!r.peek_live,
      peek_user_id: r.peek_user_id ?? "",
      actor: r.actor_id
        ? {
            id: r.actor_id,
            handle: r.handle ?? "",
            name: r.name ?? "",
            avatar: r.avatar,
            verified: r.verified,
            official: !!admin && r.handle === admin ? 1 : 0,
          }
        : null,
    }));
    return Response.json({ items, unread: await unreadCount(uid) });
  }
  if (path[1] === "unread" && method === "GET")
    return Response.json({ unread: await unreadCount(uid) });
  if (path[1] === "read" && method === "POST") {
    await db()
      .prepare("UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL")
      .bind(Date.now(), uid)
      .run();
    return Response.json({ ok: true });
  }
  throw new HttpError(404, "Not found.");
}
