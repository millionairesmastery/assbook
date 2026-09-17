import { env, waitUntil } from "cloudflare:workers";
import type { Profile } from "./types";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function db() {
  if (!env.DB)
    throw new HttpError(503, "The database is unavailable. Please try again.");
  return env.DB;
}
export function bucket() {
  if (!env.BUCKET) throw new HttpError(503, "Photo storage is unavailable.");
  return env.BUCKET;
}
// The moderator is identified by handle. Handles are stored lowercase, so the
// configured value is normalised the same way.
export function adminHandle() {
  return (env.ADMIN_HANDLE ?? "").trim().toLowerCase();
}
// The person who made the site, suggested second to new members.
export function creatorHandle() {
  return String((env as { CREATOR_HANDLE?: string }).CREATOR_HANDLE ?? "")
    .trim()
    .toLowerCase();
}
// New members follow this many people before they are done onboarding, or as
// many as exist while the community is still tiny.
export const ONBOARDING_FOLLOWS = 3;
// Runs work after the response is sent. Errors are logged, never thrown.
export function background(task: Promise<unknown>) {
  const guarded = task.catch((e) =>
    console.error(
      JSON.stringify({
        event: "background_error",
        error: e instanceof Error ? e.message : String(e),
      }),
    ),
  );
  try {
    waitUntil(guarded);
  } catch {
    // Outside a request context the promise simply runs on its own.
  }
}
export function clientIp(req: Request) {
  return req.headers.get("cf-connecting-ip") ?? "local";
}
// Route ids are UUIDs in production and short words in the seed data. Anything
// outside that shape is a 404 rather than a database error.
export const idPattern = /^[a-zA-Z0-9_-]{1,64}$/;
export function uuid(value: string | undefined) {
  if (!value || !idPattern.test(value)) throw new HttpError(404, "Not found.");
  return value;
}
// LIKE treats % and _ as wildcards. Escape them so a search for "_" does not
// match every row.
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}
export async function readBody(req: Request, max = 12000) {
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, "That file or message is too large.");
    }
    chunks.push(part.value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
export async function body(req: Request) {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Send JSON.");
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(await readBody(req)));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Invalid request.");
    return value as Record<string, unknown>;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "Invalid request.");
  }
}
export function str(value: unknown, max: number, min = 0) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    throw new HttpError(400, "Please check the length of your text.");
  return value.trim();
}
export async function hash(s: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export async function legacyPasswordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: new TextEncoder().encode(salt),
          iterations: 100000,
          hash: "SHA-256",
        },
        key,
        256,
      ),
    ),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export async function equal(a: string, b: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(a),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const msg = new TextEncoder().encode("assbook-password-check");
  const sig = await crypto.subtle.sign("HMAC", key, msg);
  const other = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(b),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", other, sig, msg);
}
// How long a display name is locked after it changes.
export const NAME_COOLDOWN_MS = 14 * 86400000;
export function sessionToken(req: Request) {
  return (
    req.headers
      .get("cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("assbook_session="))
      ?.slice(16) ?? ""
  );
}
export async function viewer(req: Request) {
  const token = sessionToken(req);
  if (!/^[a-f0-9-]{72}$/.test(token)) return null;
  const user = await db()
    .prepare(
      "SELECT u.id,u.handle,u.name,u.bio,u.avatar,u.link,u.demo,u.created,u.verified,u.name_changed_at,u.onboarded FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND s.auth_version=u.auth_version",
    )
    .bind(await hash(token), Date.now())
    .first<Omit<Profile, "onboarded"> & { name_changed_at: number | null; onboarded: number }>();
  if (!user) return null;
  const admin = adminHandle();
  const { name_changed_at, onboarded, ...profile } = user;
  const lockedUntil = name_changed_at ? name_changed_at + NAME_COOLDOWN_MS : 0;
  return {
    ...profile,
    official: !!admin && user.handle === admin ? 1 : 0,
    isAdmin: !!admin && user.handle === admin,
    nameLockedUntil: lockedUntil > Date.now() ? lockedUntil : null,
    onboarded: onboarded === 1,
  };
}
export async function requireUser(req: Request) {
  const user = await viewer(req);
  if (!user) throw new HttpError(401, "Join or sign in to do that.");
  return user;
}
export function sameOrigin(req: Request) {
  if (
    req.headers.get("origin") !== new URL(req.url).origin ||
    req.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new HttpError(403, "Please submit from Assbook.");
}
function limitKey(key: string, windowMs: number) {
  return key + ":" + Math.floor(Date.now() / windowMs);
}
export async function rate(key: string, max = 30, windowMs = 60000) {
  const now = Date.now();
  const result = await db()
    .prepare(
      "INSERT INTO limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
    )
    .bind(limitKey(key, windowMs), now + windowMs)
    .first<{ count: number }>();
  if (result && result.count > max)
    throw new HttpError(429, "A little breather. Please try again shortly.");
}
// Reads the current count without incrementing it.
export async function rateCount(key: string, windowMs: number) {
  const row = await db()
    .prepare("SELECT count FROM limits WHERE key=?")
    .bind(limitKey(key, windowMs))
    .first<{ count: number }>();
  return row?.count ?? 0;
}
export async function rateReset(key: string, windowMs: number) {
  await db().prepare("DELETE FROM limits WHERE key=?").bind(limitKey(key, windowMs)).run();
}
// Per-IP limit for unauthenticated reads. Keeps scans and searches from
// being free for anyone with a loop.
export async function readLimit(req: Request, category: string, max: number) {
  await rate("read:" + category + ":" + await hash(clientIp(req)), max, 60000);
}
export async function newSession(req: Request, id: string, version: number) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const result = await db()
    .prepare("INSERT INTO sessions(token,user_id,expires,auth_version) SELECT ?,id,?,auth_version FROM users WHERE id=? AND auth_version=?")
    .bind(await hash(token), Date.now() + 7 * 86400000, id, version)
    .run();
  if (!result.meta.changes) throw new HttpError(401, "Your account changed. Please sign in again.");
  background(housekeeping());
  return cookie(req, token);
}
// Opportunistic cleanup, run after sign-ins. There is no cron trigger in this
// deployment, so expired rows and orphaned photos are reclaimed here.
export async function housekeeping() {
  const now = Date.now();
  await db().batch([
    db().prepare("DELETE FROM sessions WHERE expires<?").bind(now),
    db().prepare("DELETE FROM limits WHERE expires<?").bind(now),
    db().prepare("DELETE FROM auth_tokens WHERE expires<?").bind(now),
  ]);
  // Uploads older than a day that never became an avatar or a live post.
  const orphans = await db()
    .prepare(
      "SELECT id FROM uploads up WHERE created<? AND NOT EXISTS(SELECT 1 FROM users WHERE avatar='/api/photo/'||up.id) AND NOT EXISTS(SELECT 1 FROM posts WHERE image='/api/photo/'||up.id AND deleted=0) LIMIT 20",
    )
    .bind(now - 86400000)
    .all<{ id: string }>();
  for (const row of orphans.results) await deleteUnusedUpload(row.id);
  // Expired peeks lose their clip; the record stays.
  const { purgePeekFiles } = await import("./peeks");
  await purgePeekFiles();
  // Old notifications go after two months; nobody scrolls that far back.
  const { purgeOldNotifications } = await import("./notifications");
  await purgeOldNotifications();
}
// Removes a photo from R2 and the uploads table if nothing references it.
export async function deleteUnusedUpload(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) return;
  const url = "/api/photo/" + id;
  const used = await db()
    .prepare(
      "SELECT 1 FROM users WHERE avatar=? UNION ALL SELECT 1 FROM posts WHERE image=? AND deleted=0 LIMIT 1",
    )
    .bind(url, url)
    .first();
  if (used) return;
  await bucket().delete(id);
  await db().prepare("DELETE FROM uploads WHERE id=?").bind(id).run();
}
export function photoId(url: string | null | undefined) {
  const m = /^\/api\/photo\/([a-f0-9-]{36})$/.exec(url ?? "");
  return m ? m[1] : null;
}
export function cookie(req: Request, token: string) {
  return (
    "assbook_session=" +
    token +
    "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" +
    (token ? "604800" : "0") +
    (new URL(req.url).protocol === "https:" ? "; Secure" : "")
  );
}
export async function ownImage(value: unknown, userId: string) {
  if (value == null || value === "") return null;
  const url = str(value, 150);
  const id = photoId(url);
  if (
    !id ||
    !(await db()
      .prepare("SELECT id FROM uploads WHERE id=? AND user_id=?")
      .bind(id, userId)
      .first())
  )
    throw new HttpError(400, "Please upload your own photo.");
  return url;
}
export async function visiblePost(id: string, uid: string) {
  const p = await db()
    .prepare(
      "SELECT p.* FROM posts p WHERE p.id=? AND p.deleted=0 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.target_id=p.user_id) OR (b.user_id=p.user_id AND b.target_id=?))",
    )
    .bind(id, uid, uid)
    .first<{ id: string; user_id: string }>();
  if (!p) throw new HttpError(404, "This post is unavailable.");
  return p;
}
