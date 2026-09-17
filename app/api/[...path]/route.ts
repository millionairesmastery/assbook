import { authRoute } from "@/lib/auth";
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
  HttpError,
} from "@/lib/server";
export const dynamic = "force-dynamic";
const blockClause =
  "NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.target_id=u.id) OR (b.user_id=u.id AND b.target_id=?))";
const writePaths = [
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
      // Two for the reply count, one each for liked and saved, two for blocks.
      const args: (string | number)[] = [uid, uid, uid, uid, uid, uid];
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
      const single = url.searchParams.get("post");
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
        .prepare(
          "SELECT p.id,p.user_id,p.body,p.image,p.created,u.handle,u.name,u.avatar,u.demo,(SELECT count(*) FROM likes l WHERE l.post_id=p.id) likes,(SELECT count(*) FROM comments c WHERE c.post_id=p.id AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.target_id=c.user_id) OR (b.user_id=c.user_id AND b.target_id=?))) comments,EXISTS(SELECT 1 FROM likes l WHERE l.post_id=p.id AND l.user_id=?) liked,EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id=p.id AND b.user_id=?) saved FROM posts p JOIN users u ON u.id=p.user_id WHERE " +
            clauses.join(" AND ") +
            " ORDER BY p.created DESC,p.id DESC LIMIT 31",
        )
        .bind(...args)
        .all<{ id: string; created: number }>();
      const hasMore = rows.results.length > 30;
      const posts = rows.results.slice(0, 30);
      const last = posts[posts.length - 1];
      return json({
        posts,
        hasMore,
        next: hasMore && last ? { created: last.created, id: last.id } : null,
      });
    }
    if (path[0] === "people" && method === "GET") {
      await readLimit(req, "api", 120);
      return json({
        people: (
          await db()
            .prepare(
              "SELECT u.id,u.handle,u.name,u.bio,u.avatar,u.demo,u.created,EXISTS(SELECT 1 FROM follows f WHERE f.user_id=? AND f.target_id=u.id) following,(SELECT count(*) FROM follows f WHERE f.target_id=u.id) followers FROM users u WHERE u.id!=? AND " +
                blockClause +
                " ORDER BY u.demo ASC,u.created DESC LIMIT 20",
            )
            .bind(uid, uid, uid, uid)
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
          "SELECT u.id,u.handle,u.name,u.bio,u.avatar,u.demo,u.created,(SELECT count(*) FROM follows f WHERE f.target_id=u.id) followers,EXISTS(SELECT 1 FROM follows f WHERE f.user_id=? AND f.target_id=u.id) following FROM users u WHERE u.handle=? AND " +
            blockClause,
        )
        .bind(uid, path[1], uid, uid)
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
      const name = d.name === undefined ? null : str(d.name, 40, 1);
      const bio = d.bio === undefined ? null : str(d.bio, 160);
      const setAvatar = "avatar" in d;
      const avatar = setAvatar ? await ownImage(d.avatar, user.id) : null;
      await db()
        .prepare(
          "UPDATE users SET name=COALESCE(?,name),bio=COALESCE(?,bio),avatar=CASE WHEN ? THEN ? ELSE avatar END WHERE id=?",
        )
        .bind(name, bio, setAvatar ? 1 : 0, avatar, user.id)
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
      await visiblePost(uuid(path[1]), user.id);
      const table = path[0] === "like" ? "likes" : "bookmarks";
      await db()
        .prepare(
          method === "PUT"
            ? "INSERT OR IGNORE INTO " + table + "(user_id,post_id) VALUES(?,?)"
            : "DELETE FROM " + table + " WHERE user_id=? AND post_id=?",
        )
        .bind(user.id, path[1])
        .run();
      return json({ ok: true });
    }
    if (
      ["follow", "block"].includes(path[0]) &&
      ["PUT", "DELETE"].includes(method)
    ) {
      const target = uuid(path[1]);
      if (
        target === user.id ||
        !(await db()
          .prepare("SELECT id FROM users WHERE id=?")
          .bind(target)
          .first())
      )
        throw new HttpError(400, "Choose another profile.");
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
      await db()
        .prepare(
          method === "PUT"
            ? "INSERT OR IGNORE INTO " +
                table +
                "(user_id,target_id) VALUES(?,?)"
            : "DELETE FROM " + table + " WHERE user_id=? AND target_id=?",
        )
        .bind(user.id, target)
        .run();
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
      await visiblePost(uuid(path[1]), user.id);
      const d = await body(req);
      await db()
        .prepare(
          "INSERT INTO comments(id,post_id,user_id,body,created) VALUES(?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          path[1],
          user.id,
          str(d.body, 280, 1),
          Date.now(),
        )
        .run();
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
      await visiblePost(uuid(path[1]), user.id);
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
      if (path[1] === "photo") {
        const id = uuid(path[2]);
        const link = "/api/photo/" + id;
        if (method === "POST" && path[3] === "approve") {
          const result = await db()
            .prepare("UPDATE uploads SET flagged=0,flag_reason=NULL WHERE id=? AND flagged=1")
            .bind(id)
            .run();
          if (!result.meta.changes) throw new HttpError(404, "Photo not found.");
          moderation("approve_photo", user.id, id);
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
          moderation("remove_photo", user.id, id);
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
