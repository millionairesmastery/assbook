import { authRoute, handleAvailability } from "@/lib/auth";
import { peeksRoute, removePeeksWithFrame } from "@/lib/peeks";
import { notificationsRoute, notify } from "@/lib/notifications";
import { checkPhoto, type PhotoTarget } from "@/lib/moderation";
import {
  db,
  bucket,
  json,
  body,
  str,
  hash,
  viewer,
  requireUser,
  sameOrigin,
  rate,
  readLimit,
  cookie,
  sessionToken,
  ownImage,
  visiblePost,
  readBody,
  uuid,
  idPattern,
  escapeLike,
  photoId,
  deleteUnusedUpload,
  background,
  adminHandle,
  creatorHandle,
  ONBOARDING_FOLLOWS,
  HttpError,
} from "@/lib/server";
export const dynamic = "force-dynamic";
const blockClause =
  "NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.target_id=u.id) OR (b.user_id=u.id AND b.target_id=?))";
// One post row as the client sees it. Binds, in order: the official handle,
// two viewer ids for the reply count, one for liked, one for saved.
const postSelect =
  "SELECT p.id,p.user_id,p.body,p.image,p.created,p.pinned,p.edited_at,u.handle,u.name,u.avatar,u.demo,u.verified,(u.handle=?) official,(SELECT count(*) FROM likes l WHERE l.post_id=p.id) likes,(SELECT count(*) FROM comments c WHERE c.post_id=p.id AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.target_id=c.user_id) OR (b.user_id=c.user_id AND b.target_id=?))) comments,EXISTS(SELECT 1 FROM likes l WHERE l.post_id=p.id AND l.user_id=?) liked,EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id=p.id AND b.user_id=?) saved FROM posts p JOIN users u ON u.id=p.user_id WHERE ";
// One person row. Binds: the official handle, then the viewer id.
const personSelect =
  "SELECT u.id,u.handle,u.name,u.bio,u.avatar,u.link,u.demo,u.created,u.verified,(u.handle=?) official,(EXISTS(SELECT 1 FROM peeks k WHERE k.user_id=u.id AND k.deleted=0 AND k.expires>(strftime('%s','now')*1000)) OR EXISTS(SELECT 1 FROM peek_shares s JOIN peeks k2 ON k2.id=s.peek_id WHERE s.user_id=u.id AND k2.deleted=0 AND k2.expires>(strftime('%s','now')*1000))) has_peek,EXISTS(SELECT 1 FROM follows f WHERE f.user_id=? AND f.target_id=u.id) following,(SELECT count(*) FROM follows f WHERE f.target_id=u.id) followers FROM users u ";
const writePaths = [
  "suggestions",
  "onboarding",
  "upload",
  "profile",
  "posts",
  "like",
  "save",
  "follow",
  "block",
  "blocks",
  "comments",
  "report",
  "admin",
];
const EDIT_WINDOW_MS = 15 * 60000;
function moderation(action: string, by: string, post: string) {
  console.log(JSON.stringify({ event: "moderation", action, by, post }));
}
async function handle(req: Request) {
  try {
    const url = new URL(req.url),
      path = url.pathname.slice(5).split("/"),
      method = req.method;
    if (method !== "GET") sameOrigin(req);
    const me = await viewer(req),
      uid = me?.id ?? "";
    if (path[0] === "me" && method === "GET") return json({ user: me });
    const authResponse = await authRoute(req, url.pathname.slice(5));
    if (authResponse) return authResponse;
    if (path[0] === "notifications") {
      const me = await requireUser(req);
      return await notificationsRoute(path, method, me.id);
    }
    if (path[0] === "peeks" || path[0] === "peek-upload") {
      if (path[0] === "peeks" && !path[1] && method === "GET")
        url.searchParams.set("official", adminHandle());
      return await peeksRoute(req, path, method, me, url);
    }
    if (path[0] === "logout" && method === "POST") {
      await db()
        .prepare("DELETE FROM sessions WHERE token=?")
        .bind(await hash(sessionToken(req)))
        .run();
      return json({ ok: true }, 200, { "Set-Cookie": cookie(req, "") });
    }
    if (path[0] === "feed" && method === "GET") {
      await readLimit(req, "api", 120);
      const filter = url.searchParams.get("filter") ?? "everyone",
        q = (url.searchParams.get("q") ?? "").trim().slice(0, 100),
        profile = url.searchParams.get("profile") ?? "",
        before = Number(url.searchParams.get("before")) || 0,
        beforeId = url.searchParams.get("beforeId") ?? "";
      const clauses = ["p.deleted=0", blockClause];
      const args: (string | number)[] = [adminHandle(), uid, uid, uid, uid, uid, uid];
      const single = url.searchParams.get("post");
      // Pinned posts are the welcome for newcomers. They come first on page
      // one of the Everyone and Following tabs until the member has finished
      // the follow step and seen their feed once; that first feed after
      // onboarding is the last time. Visitors (shared links) always get them
      // first. Afterwards pinned posts sit in the timeline like any other.
      const status = me
        ? await db()
            .prepare("SELECT onboarded,welcomed FROM users WHERE id=?")
            .bind(me.id)
            .first<{ onboarded: number; welcomed: number }>()
        : null;
      const newcomer = !status || !status.onboarded || !status.welcomed;
      const mainFeed =
        newcomer && ["everyone", "following"].includes(filter) && !q && !profile && !single;
      if (mainFeed) clauses.push("p.pinned=0");
      if (mainFeed && !before && status && status.onboarded && !status.welcomed)
        background(
          db().prepare("UPDATE users SET welcomed=1 WHERE id=?").bind(me!.id).run(),
        );
      if (filter === "following") {
        clauses.push(
          "EXISTS(SELECT 1 FROM follows f WHERE f.user_id=? AND f.target_id=u.id)",
        );
        args.push(uid);
      }
      if (filter === "saved") {
        clauses.push(
          "EXISTS(SELECT 1 FROM bookmarks b WHERE b.user_id=? AND b.post_id=p.id)",
        );
        args.push(uid);
      }
      if (profile) {
        clauses.push("u.handle=?");
        args.push(profile);
      }
      if (single) {
        clauses.push("p.id=?");
        args.push(single);
      }
      if (q) {
        // Search cannot use an index, so it gets a tighter per-IP limit.
        await readLimit(req, "search", 20);
        clauses.push(
          "(p.body LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\' OR u.handle LIKE ? ESCAPE '\\')",
        );
        const like = "%" + escapeLike(q) + "%";
        args.push(like, like, like);
      }
      // Keyset pagination: stable under concurrent posting, no offset scan.
      if (before && idPattern.test(beforeId)) {
        clauses.push("(p.created<? OR (p.created=? AND p.id<?))");
        args.push(before, before, beforeId);
      }
      const rows = await db()
        .prepare(postSelect + clauses.join(" AND ") + " ORDER BY p.created DESC,p.id DESC LIMIT 31")
        .bind(...args)
        .all<{ id: string; created: number }>();
      const hasMore = rows.results.length > 30;
      let posts = rows.results.slice(0, 30);
      if (mainFeed && !before) {
        const pinned = await db()
          .prepare(
            postSelect + "p.deleted=0 AND p.pinned=1 AND " + blockClause + " ORDER BY p.created DESC LIMIT 3",
          )
          .bind(adminHandle(), uid, uid, uid, uid, uid, uid)
          .all<{ id: string; created: number }>();
        posts = [...pinned.results, ...posts];
      }
      const last = rows.results.slice(0, 30).at(-1);
      return json({
        posts,
        hasMore,
        next: hasMore && last ? { created: last.created, id: last.id } : null,
      });
    }
    if (path[0] === "top" && method === "GET") {
      // Bums of the month: the most liked posts of the last 30 days.
      await readLimit(req, "api", 120);
      const since = Date.now() - 30 * 86400000;
      return json({
        posts: (
          await db()
            .prepare(
              postSelect +
                "p.deleted=0 AND p.created>? AND " +
                blockClause +
                " AND (SELECT count(*) FROM likes l WHERE l.post_id=p.id)>0 ORDER BY likes DESC,p.created DESC LIMIT 5",
            )
            .bind(adminHandle(), uid, uid, uid, uid, since, uid, uid)
            .all()
        ).results,
      });
    }
    if (path[0] === "people" && method === "GET") {
      await readLimit(req, "api", 120);
      return json({
        people: (
          await db()
            .prepare(
              personSelect + "WHERE u.id!=? AND " + blockClause + " ORDER BY u.demo ASC,u.created DESC LIMIT 60",
            )
            .bind(adminHandle(), uid, uid, uid, uid)
            .all()
        ).results,
      });
    }
    if (path[0] === "handle" && method === "GET") {
      // Live check while somebody types their handle on the signup form.
      await readLimit(req, "search", 60);
      const result = await handleAvailability(String(path[1] ?? "").slice(0, 40));
      return json(result);
    }
    if (path[0] === "search" && path[1] === "people" && method === "GET") {
      // Typeahead for the search box: names and handles, best matches first.
      await readLimit(req, "search", 60);
      const q = (url.searchParams.get("q") ?? "").trim().slice(0, 40);
      if (q.length < 1) return json({ people: [] });
      const like = "%" + escapeLike(q.toLowerCase()) + "%";
      const prefix = escapeLike(q.toLowerCase()) + "%";
      return json({
        people: (
          await db()
            .prepare(
              personSelect +
                "WHERE (lower(u.name) LIKE ? ESCAPE '\\' OR u.handle LIKE ? ESCAPE '\\') AND " +
                blockClause +
                " ORDER BY CASE WHEN u.handle LIKE ? ESCAPE '\\' OR lower(u.name) LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,u.demo ASC,u.name COLLATE NOCASE LIMIT 8",
            )
            .bind(adminHandle(), uid, like, like, uid, uid, prefix, prefix)
            .all()
        ).results,
      });
    }
    if (path[0] === "profile" && method === "GET" && ["followers", "following"].includes(path[2] ?? "")) {
      await readLimit(req, "api", 120);
      if (!/^[a-z0-9_]{3,24}$/.test(path[1] ?? ""))
        throw new HttpError(404, "This profile is unavailable.");
      const owner = await db()
        .prepare("SELECT u.id FROM users u WHERE u.handle=? AND " + blockClause)
        .bind(path[1], uid, uid)
        .first<{ id: string }>();
      if (!owner) throw new HttpError(404, "This profile is unavailable.");
      const relation =
        path[2] === "followers"
          ? "JOIN follows r ON r.user_id=u.id AND r.target_id=? "
          : "JOIN follows r ON r.target_id=u.id AND r.user_id=? ";
      return json({
        people: (
          await db()
            .prepare(personSelect + relation + "WHERE " + blockClause + " ORDER BY u.name COLLATE NOCASE LIMIT 100")
            .bind(adminHandle(), uid, owner.id, uid, uid)
            .all()
        ).results,
      });
    }
    if (path[0] === "profile" && method === "GET") {
      await readLimit(req, "api", 120);
      if (!/^[a-z0-9_]{3,24}$/.test(path[1] ?? ""))
        throw new HttpError(404, "This profile is unavailable.");
      const u = await db()
        .prepare(
          "SELECT u.id,u.handle,u.name,u.bio,u.avatar,u.link,u.demo,u.created,u.verified,(u.handle=?) official,(EXISTS(SELECT 1 FROM peeks k WHERE k.user_id=u.id AND k.deleted=0 AND k.expires>(strftime('%s','now')*1000)) OR EXISTS(SELECT 1 FROM peek_shares s JOIN peeks k2 ON k2.id=s.peek_id WHERE s.user_id=u.id AND k2.deleted=0 AND k2.expires>(strftime('%s','now')*1000))) has_peek,(SELECT count(*) FROM follows f WHERE f.target_id=u.id) followers,(SELECT count(*) FROM follows f WHERE f.user_id=u.id) following_count,(SELECT count(*) FROM posts p WHERE p.user_id=u.id AND p.deleted=0) posts_count,EXISTS(SELECT 1 FROM follows f WHERE f.user_id=? AND f.target_id=u.id) following FROM users u WHERE u.handle=? AND " +
            blockClause,
        )
        .bind(adminHandle(), uid, path[1], uid, uid)
        .first();
      if (!u) throw new HttpError(404, "This profile is unavailable.");
      return json({ profile: u });
    }
    if (path[0] === "comments" && method === "GET") {
      await readLimit(req, "api", 120);
      await visiblePost(uuid(path[1]), uid);
      return json({
        comments: (
          await db()
            .prepare(
              "SELECT c.id,c.post_id,c.user_id,c.body,c.created,u.handle,u.name,u.avatar FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? AND " +
                blockClause +
                " ORDER BY c.created ASC LIMIT 100",
            )
            .bind(path[1], uid, uid)
            .all()
        ).results,
      });
    }
    if (path[0] === "photo" && method === "GET") {
      const id = uuid(path[1]);
      const link = "/api/photo/" + id;
      // One indexed lookup: who owns it, and whether it is on a live post or
      // an avatar (which is what makes it visible to other people).
      const photo = await db()
        .prepare(
          "SELECT up.user_id,(EXISTS(SELECT 1 FROM users WHERE avatar=?) OR EXISTS(SELECT 1 FROM posts WHERE image=? AND deleted=0)) published FROM uploads up WHERE up.id=?",
        )
        .bind(link, link, id)
        .first<{ user_id: string; published: number }>();
      if (!photo) throw new HttpError(404, "Photo not found.");
      if (photo.user_id !== uid && !me?.isAdmin) {
        if (!photo.published) throw new HttpError(404, "Photo not found.");
        // Blocking hides photos too, in both directions.
        if (
          uid &&
          (await db()
            .prepare(
              "SELECT 1 FROM blocks WHERE (user_id=? AND target_id=?) OR (user_id=? AND target_id=?)",
            )
            .bind(uid, photo.user_id, photo.user_id, uid)
            .first())
        )
          throw new HttpError(404, "Photo not found.");
      }
      const object = await bucket().get(id);
      if (!object) throw new HttpError(404, "Photo not found.");
      const headers: Record<string, string> = {
        "Content-Type": object.httpMetadata?.contentType ?? "image/jpeg",
        "X-Content-Type-Options": "nosniff",
        // Stored by the browser but revalidated on every use, so access
        // checks still run and blocked or deleted photos disappear promptly.
        "Cache-Control": "private, no-cache",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        ETag: object.httpEtag,
        "Content-Length": String(object.size),
      };
      if (req.headers.get("if-none-match") === object.httpEtag)
        return new Response(null, { status: 304, headers });
      return new Response(object.body, { headers });
    }
    if (!writePaths.includes(path[0])) throw new HttpError(404, "Not found.");
    const user = await requireUser(req);
    await rate("write:" + user.id, 40);
    if (path[0] === "suggestions" && method === "GET") {
      // Who a new member should follow: the official account, the creator,
      // then everyone else by followers. Real accounts only, nobody already
      // followed, nobody blocked either way.
      const people = (
        await db()
          .prepare(
            personSelect +
              "WHERE u.id!=? AND u.demo=0 AND NOT EXISTS(SELECT 1 FROM follows f WHERE f.user_id=? AND f.target_id=u.id) AND " +
              blockClause +
              " ORDER BY CASE WHEN u.handle=? THEN 0 WHEN u.handle=? THEN 1 ELSE 2 END,followers DESC,u.created ASC LIMIT 12",
          )
          .bind(adminHandle(), user.id, user.id, user.id, user.id, user.id, adminHandle(), creatorHandle())
          .all()
      ).results;
      const available = await db()
        .prepare("SELECT count(*) n FROM users u WHERE u.id!=? AND u.demo=0 AND " + blockClause)
        .bind(user.id, user.id, user.id)
        .first<{ n: number }>();
      const following = await db()
        .prepare("SELECT count(*) n FROM follows WHERE user_id=?")
        .bind(user.id)
        .first<{ n: number }>();
      return json({
        people,
        required: Math.min(ONBOARDING_FOLLOWS, available?.n ?? 0),
        following: following?.n ?? 0,
      });
    }
    if (path[0] === "onboarding" && path[1] === "done" && method === "POST") {
      const available = await db()
        .prepare("SELECT count(*) n FROM users u WHERE u.id!=? AND u.demo=0 AND " + blockClause)
        .bind(user.id, user.id, user.id)
        .first<{ n: number }>();
      const following = await db()
        .prepare("SELECT count(*) n FROM follows WHERE user_id=?")
        .bind(user.id)
        .first<{ n: number }>();
      const required = Math.min(ONBOARDING_FOLLOWS, available?.n ?? 0);
      if ((following?.n ?? 0) < required)
        throw new HttpError(400, "Follow " + required + " people to get going.");
      await db().prepare("UPDATE users SET onboarded=1 WHERE id=?").bind(user.id).run();
      return json({ ok: true });
    }
    if (path[0] === "upload" && method === "POST") {
      await rate("upload:" + user.id, 10, 3600000);
      if (req.headers.get("x-photo-rules") !== "accepted")
        throw new HttpError(
          400,
          "Confirm this is your own fully clothed photo.",
        );
      const bytes = await readBody(req, 2 * 1024 * 1024);
      let type = "";
      if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
        type = "image/jpeg";
      else if (
        [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)
      )
        type = "image/png";
      else if (
        new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
        new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
      )
        type = "image/webp";
      if (!type || bytes.length < 32)
        throw new HttpError(400, "Use a JPEG, PNG, or WebP photo under 2 MB.");
      const target: PhotoTarget =
        req.headers.get("x-photo-target") === "avatar" ? "avatar" : "post";
      // Dress-code check before anything is stored. Rejections never reach
      // storage; unsure photos are stored and queued for a moderator.
      const check = await checkPhoto(
        bytes,
        type,
        target,
        req.headers.get("x-photo-check-test"),
      );
      if (check.verdict === "reject") throw new HttpError(400, check.reason);
      const flagged = check.verdict === "unsure";
      const id = crypto.randomUUID();
      await bucket().put(id, bytes, { httpMetadata: { contentType: type } });
      try {
        await db()
          .prepare(
            "INSERT INTO uploads(id,user_id,created,target,flagged,flag_reason) VALUES(?,?,?,?,?,?)",
          )
          .bind(id, user.id, Date.now(), target, flagged ? 1 : 0, flagged ? check.reason : null)
          .run();
      } catch (e) {
        await bucket().delete(id);
        throw e;
      }
      return json({ url: "/api/photo/" + id, flagged }, 201);
    }
    if (path[0] === "profile" && method === "PUT") {
      const d = await body(req);
      // Partial updates: fields left out stay as they are.
      let name = d.name === undefined ? null : str(d.name, 40, 1);
      if (name === user.name) name = null;
      const bio = d.bio === undefined ? null : str(d.bio, 160);
      // Optional website: empty clears it, otherwise it must be an http(s) URL.
      const setLink = "link" in d;
      let link: string | null = null;
      if (setLink && d.link != null && d.link !== "") {
        link = str(d.link, 200);
        if (!/^https?:\/\/[^\s<>"']+$/i.test(link))
          throw new HttpError(400, "Links need to start with https:// (or http://).");
      }
      const setAvatar = "avatar" in d;
      const avatar = setAvatar ? await ownImage(d.avatar, user.id) : null;
      // A display name changes at most once every 14 days.
      if (name !== null && user.nameLockedUntil)
        throw new HttpError(
          400,
          "You changed your name recently. You can change it again on " +
            new Date(user.nameLockedUntil).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) +
            ".",
        );
      await db()
        .prepare(
          "UPDATE users SET name=COALESCE(?,name),name_changed_at=CASE WHEN ? IS NULL THEN name_changed_at ELSE ? END,bio=COALESCE(?,bio),link=CASE WHEN ? THEN ? ELSE link END,avatar=CASE WHEN ? THEN ? ELSE avatar END WHERE id=?",
        )
        .bind(name, name, Date.now(), bio, setLink ? 1 : 0, link, setAvatar ? 1 : 0, avatar, user.id)
        .run();
      const previous = photoId(user.avatar);
      if (setAvatar && previous && user.avatar !== avatar)
        background(deleteUnusedUpload(previous));
      return json({ ok: true });
    }
    if (path[0] === "posts" && method === "POST") {
      const d = await body(req),
        text = str(d.body, 500),
        image = await ownImage(d.image, user.id);
      if (!text && !image)
        throw new HttpError(400, "Add a thought or a photo.");
      await rate("post:" + user.id, 10, 600000);
      const id = crypto.randomUUID();
      await db()
        .prepare(
          "INSERT INTO posts(id,user_id,body,image,created) VALUES(?,?,?,?,?)",
        )
        .bind(id, user.id, text, image, Date.now())
        .run();
      return json({ id }, 201);
    }
    if (path[0] === "posts" && method === "PUT") {
      // Authors can fix the text for 15 minutes after posting. The photo
      // stays, and the card shows that the post was edited.
      const d = await body(req);
      const text = str(d.body, 500);
      const current = await db()
        .prepare("SELECT image,created FROM posts WHERE id=? AND user_id=? AND deleted=0")
        .bind(uuid(path[1]), user.id)
        .first<{ image: string | null; created: number }>();
      if (!current) throw new HttpError(404, "This post is unavailable.");
      if (Date.now() - current.created > EDIT_WINDOW_MS)
        throw new HttpError(400, "Posts can be edited for 15 minutes. This one has settled.");
      if (!text && !current.image) throw new HttpError(400, "Add a thought or keep the photo.");
      await db()
        .prepare("UPDATE posts SET body=?,edited_at=? WHERE id=? AND user_id=?")
        .bind(text, Date.now(), path[1], user.id)
        .run();
      return json({ ok: true, edited_at: Date.now() });
    }
    if (path[0] === "posts" && method === "DELETE") {
      const removed = await db()
        .prepare(
          "UPDATE posts SET deleted=1 WHERE id=? AND user_id=? AND deleted=0 RETURNING image",
        )
        .bind(uuid(path[1]), user.id)
        .first<{ image: string | null }>();
      if (!removed) throw new HttpError(404, "This post is unavailable.");
      const image = photoId(removed.image);
      if (image) background(deleteUnusedUpload(image));
      return json({ ok: true });
    }
    if (
      ["like", "save"].includes(path[0]) &&
      ["PUT", "DELETE"].includes(method)
    ) {
      const liked = await visiblePost(uuid(path[1]), user.id);
      const table = path[0] === "like" ? "likes" : "bookmarks";
      const written = await db()
        .prepare(
          method === "PUT"
            ? "INSERT OR IGNORE INTO " + table + "(user_id,post_id) VALUES(?,?)"
            : "DELETE FROM " + table + " WHERE user_id=? AND post_id=?",
        )
        .bind(user.id, path[1])
        .run();
      if (path[0] === "like" && method === "PUT" && written.meta.changes)
        await notify({ to: liked.user_id, actor: user.id, kind: "like", postId: liked.id });
      return json({ ok: true });
    }
    if (
      ["follow", "block"].includes(path[0]) &&
      ["PUT", "DELETE"].includes(method)
    ) {
      const target = uuid(path[1]);
      const targetUser = await db()
        .prepare("SELECT id,handle FROM users WHERE id=?")
        .bind(target)
        .first<{ id: string; handle: string }>();
      if (target === user.id || !targetUser)
        throw new HttpError(400, "Choose another profile.");
      if (path[0] === "block" && targetUser.handle === adminHandle())
        throw new HttpError(400, "The Assbook crew is here for everyone and cannot be blocked.");
      if (
        path[0] === "follow" &&
        (await db()
          .prepare(
            "SELECT 1 FROM blocks WHERE (user_id=? AND target_id=?) OR (user_id=? AND target_id=?)",
          )
          .bind(user.id, target, target, user.id)
          .first())
      )
        throw new HttpError(403, "This profile is unavailable.");
      const table = path[0] === "follow" ? "follows" : "blocks";
      const written = await db()
        .prepare(
          method === "PUT"
            ? "INSERT OR IGNORE INTO " +
                table +
                "(user_id,target_id) VALUES(?,?)"
            : "DELETE FROM " + table + " WHERE user_id=? AND target_id=?",
        )
        .bind(user.id, target)
        .run();
      if (path[0] === "follow" && method === "PUT" && written.meta.changes)
        await notify({ to: target, actor: user.id, kind: "follow" });
      if (path[0] === "block" && method === "PUT")
        await db()
          .prepare(
            "DELETE FROM follows WHERE (user_id=? AND target_id=?) OR (user_id=? AND target_id=?)",
          )
          .bind(user.id, target, target, user.id)
          .run();
      return json({ ok: true });
    }
    if (path[0] === "blocks" && method === "GET")
      return json({
        people: (
          await db()
            .prepare(
              "SELECT u.id,u.handle,u.name,u.avatar FROM users u JOIN blocks b ON b.target_id=u.id WHERE b.user_id=?",
            )
            .bind(user.id)
            .all()
        ).results,
      });
    if (path[0] === "comments" && method === "POST") {
      const target = await visiblePost(uuid(path[1]), user.id);
      const d = await body(req);
      const commentId = crypto.randomUUID();
      const words = str(d.body, 280, 1);
      await db()
        .prepare(
          "INSERT INTO comments(id,post_id,user_id,body,created) VALUES(?,?,?,?,?)",
        )
        .bind(commentId, path[1], user.id, words, Date.now())
        .run();
      await notify({
        to: target.user_id,
        actor: user.id,
        kind: "comment",
        postId: target.id,
        ref: commentId,
        body: words,
      });
      return json({ ok: true }, 201);
    }
    if (path[0] === "comments" && method === "DELETE") {
      // The author, the owner of the post, or the moderator.
      const result = await db()
        .prepare(
          "DELETE FROM comments WHERE id=? AND (user_id=? OR EXISTS(SELECT 1 FROM posts p WHERE p.id=comments.post_id AND p.user_id=?) OR ?=1)",
        )
        .bind(uuid(path[1]), user.id, user.id, user.isAdmin ? 1 : 0)
        .run();
      if (!result.meta.changes)
        throw new HttpError(404, "This reply is unavailable.");
      return json({ ok: true });
    }
    if (path[0] === "report" && method === "POST") {
      await rate("report:" + user.id, 10, 3600000);
      const reported = await visiblePost(uuid(path[1]), user.id);
      const author = await db()
        .prepare("SELECT handle FROM users WHERE id=?")
        .bind(reported.user_id)
        .first<{ handle: string }>();
      if (author?.handle === adminHandle())
        throw new HttpError(400, "Posts by the Assbook crew cannot be reported. Reply to them instead.");
      const d = await body(req);
      // One report per person per post. Repeats are accepted and ignored.
      await db()
        .prepare(
          "INSERT OR IGNORE INTO reports(id,user_id,post_id,reason,created) VALUES(?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          user.id,
          path[1],
          str(d.reason, 250, 1),
          Date.now(),
        )
        .run();
      return json({ ok: true }, 201);
    }
    if (path[0] === "admin") {
      if (!user.isAdmin) throw new HttpError(403, "Moderator access required.");
      if (method === "GET") {
        const [reports, photos] = await db().batch([
          db().prepare(
            "SELECT p.id post_id,p.body,p.image,u.handle,count(*) count,max(r.created) latest,group_concat(r.reason,char(10)) reasons FROM reports r JOIN posts p ON p.id=r.post_id JOIN users u ON u.id=p.user_id WHERE p.deleted=0 AND r.resolved=0 GROUP BY p.id ORDER BY latest DESC LIMIT 100",
          ),
          db().prepare(
            "SELECT up.id,'/api/photo/'||up.id url,up.created,up.target,up.flag_reason reason,u.handle,(EXISTS(SELECT 1 FROM users WHERE avatar='/api/photo/'||up.id) OR EXISTS(SELECT 1 FROM posts WHERE image='/api/photo/'||up.id AND deleted=0)) in_use FROM uploads up JOIN users u ON u.id=up.user_id WHERE up.flagged=1 ORDER BY up.created DESC LIMIT 100",
          ),
        ]);
        return json({ reports: reports.results, photos: photos.results });
      }
      if (path[1] === "verify" && method === "POST") {
        // Verification is granted by the moderator: "user", "business", or
        // nothing to take it back.
        const target = uuid(path[2]);
        const d = await body(req);
        const kind = d.kind === "user" || d.kind === "business" ? d.kind : null;
        const result = await db()
          .prepare("UPDATE users SET verified=? WHERE id=? AND demo=0")
          .bind(kind, target)
          .run();
        if (!result.meta.changes) throw new HttpError(404, "This profile is unavailable.");
        moderation(kind ? "verify_" + kind : "unverify", user.id, target);
        return json({ ok: true, verified: kind });
      }
      if (path[1] === "pin" && method === "POST") {
        const id = uuid(path[2]);
        const toggled = await db()
          .prepare("UPDATE posts SET pinned=CASE WHEN pinned=1 THEN 0 ELSE 1 END WHERE id=? AND deleted=0 RETURNING pinned")
          .bind(id)
          .first<{ pinned: number }>();
        if (!toggled) throw new HttpError(404, "This post is unavailable.");
        moderation(toggled.pinned ? "pin" : "unpin", user.id, id);
        return json({ pinned: !!toggled.pinned });
      }
      if (path[1] === "photo") {
        const id = uuid(path[2]);
        const link = "/api/photo/" + id;
        if (method === "POST" && path[3] === "approve") {
          const result = await db()
            .prepare("UPDATE uploads SET flagged=0,flag_reason=NULL WHERE id=? AND flagged=1 RETURNING user_id")
            .bind(id)
            .first<{ user_id: string }>();
          if (!result) throw new HttpError(404, "Photo not found.");
          moderation("approve_photo", user.id, id);
          await notify({
            to: result.user_id,
            kind: "note",
            ref: id,
            body: "A moderator looked at your photo and kept it. Thanks for keeping it classy.",
          });
          return json({ ok: true });
        }
        if (method === "DELETE") {
          const owner = await db()
            .prepare("SELECT user_id FROM uploads WHERE id=?")
            .bind(id)
            .first<{ user_id: string }>();
          if (!owner) throw new HttpError(404, "Photo not found.");
          // Take the photo out of everything it is used in, then out of storage.
          await db().batch([
            db().prepare("UPDATE users SET avatar=NULL WHERE avatar=?").bind(link),
            db().prepare("UPDATE posts SET deleted=1 WHERE image=? AND deleted=0").bind(link),
            db().prepare(
              "UPDATE reports SET resolved=1 WHERE post_id IN (SELECT id FROM posts WHERE image=?)",
            ).bind(link),
            db().prepare("DELETE FROM uploads WHERE id=?").bind(id),
          ]);
          await bucket().delete(id);
          await removePeeksWithFrame(link);
          moderation("remove_photo", user.id, id);
          await notify({
            to: owner.user_id,
            kind: "note",
            ref: id,
            body: "A moderator removed one of your photos for breaking the dress code. Fully clothed, seen from behind, and it stays.",
          });
          return json({ ok: true });
        }
        throw new HttpError(404, "Not found.");
      }
      const post = uuid(path[1]);
      if (method === "DELETE") {
        const removed = await db()
          .prepare(
            "UPDATE posts SET deleted=1 WHERE id=? AND deleted=0 RETURNING image",
          )
          .bind(post)
          .first<{ image: string | null }>();
        if (!removed) throw new HttpError(404, "This post is unavailable.");
        await db()
          .prepare("UPDATE reports SET resolved=1 WHERE post_id=?")
          .bind(post)
          .run();
        moderation("hide", user.id, post);
        const image = photoId(removed.image);
        if (image) background(deleteUnusedUpload(image));
        return json({ ok: true });
      }
      if (method === "POST" && path[2] === "dismiss") {
        await db()
          .prepare("UPDATE reports SET resolved=1 WHERE post_id=?")
          .bind(post)
          .run();
        moderation("dismiss", user.id, post);
        return json({ ok: true });
      }
    }
    throw new HttpError(404, "Not found.");
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(
      JSON.stringify({
        event: "api_error",
        path: new URL(req.url).pathname,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
    return json(
      { error: "Something went wrong. Your draft is safe, please try again." },
      503,
    );
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
