import { notify } from "./notifications";
import {
  db,
  bucket,
  json,
  body,
  str,
  rate,
  uuid,
  photoId,
  requireUser,
  background,
  HttpError,
  readBody,
} from "./server";
import type { Profile } from "./types";

// Peeks: clips of up to ten seconds that live for a day. The file goes after that,
// the record and its numbers stay.
export const PEEK_LIFE_MS = 86400000;
const MAX_BYTES = 16 * 1024 * 1024;
const LIVE = "k.deleted=0 AND k.expires>(strftime('%s','now')*1000)";
const NOT_BLOCKED =
  "NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.target_id=u.id) OR (b.user_id=u.id AND b.target_id=?))";

type PeekRow = {
  id: string;
  user_id: string;
  caption: string;
  frame: string;
  created: number;
  expires: number;
  handle: string;
  name: string;
  avatar: string | null;
  official: number;
  verified: string | null;
  following: number;
  likes: number;
  replies: number;
  views: number;
  repeeks: number;
  liked: number;
  watched: number;
  repeeked: number;
  // Present when this row is somebody's re-peek of the creator's clip.
  shared_by_id?: string | null;
  shared_by_handle?: string | null;
  shared_by_name?: string | null;
  shared_at?: number | null;
  share_views?: number | null;
};

// Everything the client needs about one peek, with the creator attached.
const PEEK_FIELDS =
  "k.id,k.user_id,k.caption,k.frame,k.created,k.expires,u.handle,u.name,u.avatar,u.verified,(u.handle=?) official,EXISTS(SELECT 1 FROM follows f WHERE f.user_id=? AND f.target_id=u.id) following,(SELECT count(*) FROM peek_likes l WHERE l.peek_id=k.id) likes,(SELECT count(*) FROM peek_replies r WHERE r.peek_id=k.id) replies,(SELECT count(*) FROM peek_views v WHERE v.peek_id=k.id) views,(SELECT count(*) FROM peek_shares s WHERE s.peek_id=k.id) repeeks,EXISTS(SELECT 1 FROM peek_likes l WHERE l.peek_id=k.id AND l.user_id=?) liked,EXISTS(SELECT 1 FROM peek_views v WHERE v.peek_id=k.id AND v.user_id=?) watched,EXISTS(SELECT 1 FROM peek_shares s WHERE s.peek_id=k.id AND s.user_id=?) repeeked";

function videoType(bytes: Uint8Array) {
  const ascii = (from: number, to: number) =>
    new TextDecoder().decode(bytes.slice(from, to));
  if (bytes.length > 12 && ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    return brand.startsWith("qt") ? "video/quicktime" : "video/mp4";
  }
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3)
    return "video/webm";
  return "";
}

function key(id: string) {
  return "peek/" + id;
}

function shape(row: PeekRow) {
  return {
    id: row.id,
    user_id: row.user_id,
    caption: row.caption,
    video: "/api/peeks/" + row.id + "/video",
    poster: row.frame,
    created: row.created,
    expires: row.expires,
    likes: row.likes,
    replies: row.replies,
    views: row.views,
    repeeks: row.repeeks,
    liked: row.liked,
    watched: row.watched,
    repeeked: row.repeeked,
    creator: { id: row.user_id, handle: row.handle, name: row.name, avatar: row.avatar, official: row.official, verified: row.verified },
    shared_by: row.shared_by_id
      ? { id: row.shared_by_id, handle: row.shared_by_handle ?? "", name: row.shared_by_name ?? "", views: row.share_views ?? 0 }
      : null,
  };
}

async function liveOwner(id: string, uid: string) {
  const row = await db()
    .prepare(
      "SELECT k.id,k.user_id,u.handle FROM peeks k JOIN users u ON u.id=k.user_id WHERE k.id=? AND " +
        LIVE +
        " AND " +
        NOT_BLOCKED,
    )
    .bind(id, uid, uid)
    .first<{ id: string; user_id: string; handle: string }>();
  if (!row) throw new HttpError(404, "This peek is gone.");
  return row;
}

// Removes a clip from storage once it has expired or been removed.
export async function purgePeekFiles(limit = 20) {
  const rows = await db()
    .prepare(
      "SELECT id FROM peeks WHERE file_gone=0 AND (deleted=1 OR expires<(strftime('%s','now')*1000)) LIMIT ?",
    )
    .bind(limit)
    .all<{ id: string }>();
  for (const row of rows.results) {
    await bucket().delete(key(row.id));
    await db().prepare("UPDATE peeks SET file_gone=1 WHERE id=?").bind(row.id).run();
  }
}

// Called when a moderator removes a photo that served as a peek's frame.
export async function removePeeksWithFrame(frameUrl: string) {
  await db().prepare("UPDATE peeks SET deleted=1 WHERE frame=?").bind(frameUrl).run();
  background(purgePeekFiles());
}

export async function peeksRoute(
  req: Request,
  path: string[],
  method: string,
  me: (Profile & { isAdmin?: boolean }) | null,
  url: URL,
): Promise<Response> {
  const uid = me?.id ?? "";

  // The clip itself. Signed-in members only, blocks respected, ranges honoured
  // so the browser's own player can seek.
  if (path[0] === "peeks" && path[2] === "video" && method === "GET") {
    if (!me) throw new HttpError(401, "Sign in to watch peeks.");
    const id = uuid(path[1]);
    const row = await db()
      .prepare(
        "SELECT k.id,k.content_type,k.file_gone FROM peeks k JOIN users u ON u.id=k.user_id WHERE k.id=? AND " +
          LIVE +
          " AND " +
          NOT_BLOCKED,
      )
      .bind(id, uid, uid)
      .first<{ id: string; content_type: string; file_gone: number }>();
    if (!row || row.file_gone) throw new HttpError(404, "This peek is gone.");
    const object = await bucket().get(key(id), { range: req.headers });
    if (!object) throw new HttpError(404, "This peek is gone.");
    const headers: Record<string, string> = {
      "Content-Type": row.content_type,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ETag: object.httpEtag,
    };
    const range = object.range;
    if (range && "offset" in range && typeof range.offset === "number") {
      const length = range.length ?? object.size - range.offset;
      headers["Content-Range"] = "bytes " + range.offset + "-" + (range.offset + length - 1) + "/" + object.size;
      headers["Content-Length"] = String(length);
      return new Response(object.body, { status: 206, headers });
    }
    headers["Content-Length"] = String(object.size);
    return new Response(object.body, { headers });
  }

  if (path[0] === "peeks" && method === "GET" && !path[1]) {
    // The strip: everyone with a live peek the viewer may see, grouped by
    // person. Order: the viewer first, then people they follow with unwatched
    // peeks, then everyone else unwatched, then the already watched.
    if (!me) throw new HttpError(401, "Sign in to watch peeks.");
    const official = url.searchParams.get("official") ?? "";
    const own = await db()
      .prepare(
        "SELECT " + PEEK_FIELDS + " FROM peeks k JOIN users u ON u.id=k.user_id WHERE " +
          LIVE + " AND " + NOT_BLOCKED + " ORDER BY k.created ASC LIMIT 400",
      )
      .bind(official, uid, uid, uid, uid, uid, uid)
      .all<PeekRow>();
    // Re-peeks: the sharer's slot carries the creator's clip. The sharer must
    // be visible to the viewer as well as the creator.
    const shared = await db()
      .prepare(
        "SELECT " + PEEK_FIELDS +
          ",s.user_id shared_by_id,su.handle shared_by_handle,su.name shared_by_name,su.avatar shared_by_avatar,su.official_flag shared_by_official,s.created shared_at,s.views share_views FROM peek_shares s JOIN peeks k ON k.id=s.peek_id JOIN users u ON u.id=k.user_id JOIN (SELECT id,handle,name,avatar,(handle=?) official_flag FROM users) su ON su.id=s.user_id WHERE " +
          LIVE + " AND " + NOT_BLOCKED +
          " AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.target_id=s.user_id) OR (b.user_id=s.user_id AND b.target_id=?)) ORDER BY s.created ASC LIMIT 400",
      )
      .bind(official, uid, uid, uid, uid, official, uid, uid, uid, uid)
      .all<PeekRow & { shared_by_avatar: string | null; shared_by_official: number }>();
    const people = new Map<string, {
      id: string; handle: string; name: string; avatar: string | null; official: number; following: number;
      latest: number; unwatched: number; peeks: ReturnType<typeof shape>[];
    }>();
    const add = (slot: { id: string; handle: string; name: string; avatar: string | null; official: number; following: number }, row: PeekRow, at: number) => {
      const person = people.get(slot.id) ?? { ...slot, latest: 0, unwatched: 0, peeks: [] };
      person.peeks.push(shape(row));
      person.latest = Math.max(person.latest, at);
      if (!row.watched) person.unwatched += 1;
      people.set(slot.id, person);
    };
    for (const row of own.results)
      add({ id: row.user_id, handle: row.handle, name: row.name, avatar: row.avatar, official: row.official, following: row.following }, row, row.created);
    for (const row of shared.results) {
      const sharerFollowed = await db()
        .prepare("SELECT 1 FROM follows WHERE user_id=? AND target_id=?")
        .bind(uid, row.shared_by_id)
        .first();
      add(
        { id: row.shared_by_id!, handle: row.shared_by_handle ?? "", name: row.shared_by_name ?? "", avatar: row.shared_by_avatar, official: row.shared_by_official, following: sharerFollowed ? 1 : 0 },
        row,
        row.shared_at ?? row.created,
      );
    }
    const list = [...people.values()].sort((a, b) => {
      const rank = (p: typeof a) =>
        p.id === uid ? 0 : p.unwatched && p.following ? 1 : p.unwatched ? 2 : 3;
      return rank(a) - rank(b) || b.latest - a.latest;
    });
    return json({ people: list.map(({ latest: _l, ...rest }) => ({ ...rest, watched: rest.unwatched === 0 })) });
  }

  if (path[0] === "peeks" && path[1] === "archive" && method === "GET") {
    // The author's own history: numbers stay after the clip is gone.
    const user = await requireUser(req);
    const rows = await db()
      .prepare(
        "SELECT k.id,k.caption,k.frame,k.created,k.expires,k.deleted,k.file_gone,(SELECT count(*) FROM peek_likes l WHERE l.peek_id=k.id) likes,(SELECT count(*) FROM peek_replies r WHERE r.peek_id=k.id) replies,(SELECT count(*) FROM peek_views v WHERE v.peek_id=k.id) views FROM peeks k WHERE k.user_id=? ORDER BY k.created DESC LIMIT 30",
      )
      .bind(user.id)
      .all();
    return json({ peeks: rows.results });
  }

  if (path[0] === "peeks" && path[2] === "replies" && method === "GET") {
    if (!me) throw new HttpError(401, "Sign in to watch peeks.");
    const id = uuid(path[1]);
    await liveOwner(id, uid);
    const rows = await db()
      .prepare(
        "SELECT r.id,r.peek_id,r.user_id,r.body,r.created,u.handle,u.name,u.avatar FROM peek_replies r JOIN users u ON u.id=r.user_id WHERE r.peek_id=? AND " +
          NOT_BLOCKED +
          " ORDER BY r.created ASC LIMIT 100",
      )
      .bind(id, uid, uid)
      .all();
    return json({ replies: rows.results });
  }

  // Everything below writes.
  const user = await requireUser(req);
  await rate("write:" + user.id, 40);

  if (path[0] === "peek-upload" && method === "POST") {
    await rate("peek:" + user.id, 10, 86400000);
    if (req.headers.get("x-photo-rules") !== "accepted")
      throw new HttpError(400, "Confirm this is your own clip and shows no nudity.");
    const bytes = await readBody(req, MAX_BYTES);
    const type = videoType(bytes);
    if (!type || bytes.length < 1024)
      throw new HttpError(400, "Use an MP4 or WebM clip under 16 MB.");
    const id = crypto.randomUUID();
    await bucket().put(key(id), bytes, {
      httpMetadata: { contentType: type },
      customMetadata: { user: user.id, pending: "1" },
    });
    return json({ id, bytes: bytes.length, type }, 201);
  }

  if (path[0] === "peeks" && method === "POST" && !path[1]) {
    // Publish: the clip was uploaded, the frame went through the dress-code
    // check as a post photo, and both belong to this member.
    const d = await body(req);
    const video = uuid(typeof d.video === "string" ? d.video : "");
    const frame = photoId(typeof d.frame === "string" ? d.frame : "");
    const caption = d.caption === undefined ? "" : str(d.caption, 140);
    if (!frame) throw new HttpError(400, "The clip needs its checked frame.");
    const owned = await db()
      .prepare("SELECT id FROM uploads WHERE id=? AND user_id=?")
      .bind(frame, user.id)
      .first();
    if (!owned) throw new HttpError(400, "The clip needs its checked frame.");
    const object = await bucket().head(key(video));
    if (!object || object.customMetadata?.user !== user.id)
      throw new HttpError(400, "Upload the clip first.");
    const now = Date.now();
    await db()
      .prepare(
        "INSERT INTO peeks(id,user_id,caption,content_type,bytes,frame,created,expires) VALUES(?,?,?,?,?,?,?,?)",
      )
      .bind(video, user.id, caption, object.httpMetadata?.contentType ?? "video/mp4", object.size, "/api/photo/" + frame, now, now + PEEK_LIFE_MS)
      .run();
    return json(
      { peek: { id: video, caption, video: "/api/peeks/" + video + "/video", poster: "/api/photo/" + frame, created: now, expires: now + PEEK_LIFE_MS, likes: 0, replies: 0, views: 0, liked: 0, watched: 0 } },
      201,
    );
  }

  if (path[0] === "peeks" && path[2] === "view" && method === "POST") {
    const id = uuid(path[1]);
    await liveOwner(id, user.id);
    const inserted = await db()
      .prepare("INSERT OR IGNORE INTO peek_views(peek_id,user_id,created) VALUES(?,?,?)")
      .bind(id, user.id, Date.now())
      .run();
    // A first view that arrived through somebody's re-peek is credited to it
    // as well; the creator's total counts every viewer once.
    const d = req.headers.get("content-type")?.startsWith("application/json") ? await body(req) : {};
    const via = typeof d.via === "string" && /^[a-f0-9-]{36}$/.test(d.via) ? d.via : "";
    if (inserted.meta.changes && via)
      await db().prepare("UPDATE peek_shares SET views=views+1 WHERE peek_id=? AND user_id=?").bind(id, via).run();
    const views = await db().prepare("SELECT count(*) n FROM peek_views WHERE peek_id=?").bind(id).first<{ n: number }>();
    return json({ views: views?.n ?? 0 });
  }

  if (path[0] === "peeks" && path[2] === "repeek" && ["PUT", "DELETE"].includes(method)) {
    const id = uuid(path[1]);
    const row = await liveOwner(id, user.id);
    if (row.user_id === user.id) throw new HttpError(400, "That one is already yours.");
    if (method === "PUT") await rate("repeek:" + user.id, 30, 86400000);
    await db()
      .prepare(
        method === "PUT"
          ? "INSERT OR IGNORE INTO peek_shares(peek_id,user_id,created) VALUES(?,?,?)"
          : "DELETE FROM peek_shares WHERE peek_id=? AND user_id=?",
      )
      .bind(...(method === "PUT" ? [id, user.id, Date.now()] : [id, user.id]))
      .run();
    if (method === "PUT") await notify({ to: row.user_id, actor: user.id, kind: "repeek", peekId: id });
    const count = await db().prepare("SELECT count(*) n FROM peek_shares WHERE peek_id=?").bind(id).first<{ n: number }>();
    return json({ ok: true, repeeks: count?.n ?? 0 });
  }

  if (path[0] === "peeks" && path[2] === "like" && ["PUT", "DELETE"].includes(method)) {
    const id = uuid(path[1]);
    const row = await liveOwner(id, user.id);
    await db()
      .prepare(
        method === "PUT"
          ? "INSERT OR IGNORE INTO peek_likes(peek_id,user_id) VALUES(?,?)"
          : "DELETE FROM peek_likes WHERE peek_id=? AND user_id=?",
      )
      .bind(id, user.id)
      .run();
    if (method === "PUT") await notify({ to: row.user_id, actor: user.id, kind: "peek_like", peekId: id });
    return json({ ok: true });
  }

  if (path[0] === "peeks" && path[2] === "replies" && method === "POST") {
    const id = uuid(path[1]);
    const row = await liveOwner(id, user.id);
    const d = await body(req);
    const replyId = crypto.randomUUID();
    const words = str(d.body, 280, 1);
    await db()
      .prepare("INSERT INTO peek_replies(id,peek_id,user_id,body,created) VALUES(?,?,?,?,?)")
      .bind(replyId, id, user.id, words, Date.now())
      .run();
    await notify({ to: row.user_id, actor: user.id, kind: "peek_reply", peekId: id, ref: replyId, body: words });
    return json({ ok: true }, 201);
  }

  if (path[0] === "peeks" && path[2] === "replies" && method === "DELETE") {
    const result = await db()
      .prepare(
        "DELETE FROM peek_replies WHERE id=? AND peek_id=? AND (user_id=? OR EXISTS(SELECT 1 FROM peeks k WHERE k.id=peek_replies.peek_id AND k.user_id=?) OR ?=1)",
      )
      .bind(uuid(path[3]), uuid(path[1]), user.id, user.id, user.isAdmin ? 1 : 0)
      .run();
    if (!result.meta.changes) throw new HttpError(404, "This reply is unavailable.");
    return json({ ok: true });
  }

  if (path[0] === "peeks" && path[2] === "report" && method === "POST") {
    await rate("report:" + user.id, 10, 3600000);
    const id = uuid(path[1]);
    const row = await liveOwner(id, user.id);
    if (row.user_id === user.id) throw new HttpError(400, "That one is yours.");
    const d = await body(req);
    const reason = str(d.reason, 250, 1);
    const frame = await db().prepare("SELECT frame FROM peeks WHERE id=?").bind(id).first<{ frame: string }>();
    const frameId = photoId(frame?.frame);
    if (frameId)
      await db()
        .prepare("UPDATE uploads SET flagged=1,flag_reason=? WHERE id=?")
        .bind("Reported peek: " + reason, frameId)
        .run();
    return json({ ok: true }, 201);
  }

  if (path[0] === "peeks" && method === "DELETE" && path[1] && !path[2]) {
    const id = uuid(path[1]);
    const result = await db()
      .prepare("UPDATE peeks SET deleted=1 WHERE id=? AND deleted=0 AND (user_id=? OR ?=1)")
      .bind(id, user.id, user.isAdmin ? 1 : 0)
      .run();
    if (!result.meta.changes) throw new HttpError(404, "This peek is gone.");
    background(purgePeekFiles());
    return json({ ok: true });
  }

  throw new HttpError(404, "Not found.");
}
