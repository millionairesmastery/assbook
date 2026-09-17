import { authRoute } from "@/lib/auth";
import { env } from "cloudflare:workers";
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
  cookie,
  sessionToken,
  ownImage,
  visiblePost,
  readBody,
  HttpError,
} from "@/lib/server";
export const dynamic = "force-dynamic";
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
      const filter = url.searchParams.get("filter") ?? "everyone",
        q = (url.searchParams.get("q") ?? "").slice(0, 100),
        profile = url.searchParams.get("profile") ?? "",
        offset = Math.max(
          0,
          Math.min(10000, Number(url.searchParams.get("offset")) || 0),
        );
      const clauses = [
        "p.deleted=0",
        "NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.target_id=u.id) OR (b.user_id=u.id AND b.target_id=?))",
      ];
      const args: (string | number)[] = [uid, uid, uid, uid];
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
        clauses.push("(p.body LIKE ? OR u.name LIKE ? OR u.handle LIKE ?)");
        args.push("%" + q + "%", "%" + q + "%", "%" + q + "%");
      }
      args.push(offset);
      const rows = await db()
        .prepare(
          "SELECT p.id,p.user_id,p.body,p.image,p.created,u.handle,u.name,u.avatar,u.demo,(SELECT count(*) FROM likes l WHERE l.post_id=p.id) likes,(SELECT count(*) FROM comments c WHERE c.post_id=p.id AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.target_id=c.user_id))) comments,EXISTS(SELECT 1 FROM likes l WHERE l.post_id=p.id AND l.user_id=?) liked,EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id=p.id AND b.user_id=?) saved FROM posts p JOIN users u ON u.id=p.user_id WHERE " +
            clauses.join(" AND ") +
            " ORDER BY p.created DESC,p.id DESC LIMIT 30 OFFSET ?",
        )
        .bind(uid, ...args)
        .all();
      return json({ posts: rows.results, hasMore: rows.results.length === 30 });
    }
    if (path[0] === "people" && method === "GET") {
      return json({
        people: (
          await db()
            .prepare(
              "SELECT u.id,u.handle,u.name,u.bio,u.avatar,u.demo,u.created,EXISTS(SELECT 1 FROM follows f WHERE f.user_id=? AND f.target_id=u.id) following,(SELECT count(*) FROM follows f WHERE f.target_id=u.id) followers FROM users u WHERE u.id!=? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.target_id=u.id) OR (b.user_id=u.id AND b.target_id=?)) ORDER BY u.demo ASC,u.created DESC LIMIT 20",
            )
            .bind(uid, uid, uid, uid)
            .all()
        ).results,
      });
    }
    if (path[0] === "profile" && method === "GET") {
      const u = await db()
        .prepare(
          "SELECT u.id,u.handle,u.name,u.bio,u.avatar,u.demo,u.created,(SELECT count(*) FROM follows f WHERE f.target_id=u.id) followers,EXISTS(SELECT 1 FROM follows f WHERE f.user_id=? AND f.target_id=u.id) following FROM users u WHERE u.handle=? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.target_id=u.id) OR (b.user_id=u.id AND b.target_id=?))",
        )
        .bind(uid, path[1], uid, uid)
        .first();
      if (!u) throw new HttpError(404, "This profile is unavailable.");
      return json({ profile: u });
    }
    if (path[0] === "comments" && method === "GET") {
      await visiblePost(path[1], uid);
      return json({
        comments: (
          await db()
            .prepare(
              "SELECT c.id,c.body,c.created,u.handle,u.name,u.avatar FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.target_id=u.id) OR (b.user_id=u.id AND b.target_id=?)) ORDER BY c.created ASC LIMIT 100",
            )
            .bind(path[1], uid, uid)
            .all()
        ).results,
      });
    }
    if (path[0] === "photo" && method === "GET") {
      const id = path[1];
      if (!id || !/^[a-f0-9-]{36}$/.test(id))
        throw new HttpError(404, "Photo not found.");
      const owner = await db()
        .prepare("SELECT user_id FROM uploads WHERE id=?")
        .bind(id)
        .first<{ user_id: string }>();
      if (!owner) throw new HttpError(404, "Photo not found.");
      if (owner.user_id !== uid) {
        const publicUse = await db()
          .prepare(
            "SELECT 1 FROM users WHERE avatar=? UNION ALL SELECT 1 FROM posts WHERE image=? AND deleted=0 LIMIT 1",
          )
          .bind("/api/photo/" + id, "/api/photo/" + id)
          .first();
        if (!publicUse) throw new HttpError(404, "Photo not found.");
      }
      const object = await bucket().get(id);
      if (!object) throw new HttpError(404, "Photo not found.");
      return new Response(object.body, {
        headers: {
          "Content-Type": object.httpMetadata?.contentType ?? "image/jpeg",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private,no-store",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    }
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
      const id = crypto.randomUUID();
      await bucket().put(id, bytes, { httpMetadata: { contentType: type } });
      try {
        await db()
          .prepare("INSERT INTO uploads(id,user_id,created) VALUES(?,?,?)")
          .bind(id, user.id, Date.now())
          .run();
      } catch (e) {
        await bucket().delete(id);
        throw e;
      }
      return json({ url: "/api/photo/" + id }, 201);
    }
    if (path[0] === "profile" && method === "PUT") {
      const d = await body(req);
      await db()
        .prepare("UPDATE users SET name=?,bio=?,avatar=? WHERE id=?")
        .bind(
          str(d.name, 40, 1),
          str(d.bio, 160),
          await ownImage(d.avatar, user.id),
          user.id,
        )
        .run();
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
      await db()
        .prepare("UPDATE posts SET deleted=1 WHERE id=? AND user_id=?")
        .bind(path[1], user.id)
        .run();
      return json({ ok: true });
    }
    if (
      ["like", "save"].includes(path[0]) &&
      ["PUT", "DELETE"].includes(method)
    ) {
      await visiblePost(path[1], user.id);
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
      const target = path[1];
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
      await visiblePost(path[1], user.id);
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
    if (path[0] === "report" && method === "POST") {
      await visiblePost(path[1], user.id);
      const d = await body(req);
      await db()
        .prepare(
          "INSERT INTO reports(id,user_id,post_id,reason,created) VALUES(?,?,?,?,?)",
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
      if (!env.ADMIN_HANDLE || user.handle !== env.ADMIN_HANDLE)
        throw new HttpError(403, "Moderator access required.");
      if (method === "GET")
        return json({
          reports: (
            await db()
              .prepare(
                "SELECT r.id,r.post_id,r.reason,r.created,p.body,u.handle FROM reports r JOIN posts p ON p.id=r.post_id JOIN users u ON u.id=p.user_id WHERE p.deleted=0 ORDER BY r.created DESC LIMIT 100",
              )
              .all()
          ).results,
        });
      if (method === "DELETE") {
        await db()
          .prepare("UPDATE posts SET deleted=1 WHERE id=?")
          .bind(path[1])
          .run();
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
      { error: "Something went wrong. Your draft is safe—please try again." },
      503,
    );
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
