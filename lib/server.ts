import { env } from "cloudflare:workers";
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
      "SELECT u.id,u.handle,u.name,u.bio,u.avatar,u.demo,u.created FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND s.auth_version=u.auth_version",
    )
    .bind(await hash(token), Date.now())
    .first<Profile>();
  return user
    ? {
        ...user,
        isAdmin: !!env.ADMIN_HANDLE && user.handle === env.ADMIN_HANDLE,
      }
    : null;
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
export async function rate(key: string, max = 30, windowMs = 60000) {
  const now = Date.now();
  const bucketKey = key + ":" + Math.floor(now / windowMs);
  const result = await db()
    .prepare(
      "INSERT INTO limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
    )
    .bind(bucketKey, now + windowMs)
    .first<{ count: number }>();
  if (result && result.count > max)
    throw new HttpError(429, "A little breather. Please try again shortly.");
}
export async function newSession(req: Request, id: string, version: number) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const result = await db().batch([
    db().prepare("DELETE FROM sessions WHERE expires<?").bind(Date.now()),
    db().prepare("DELETE FROM limits WHERE expires<?").bind(Date.now()),
    db()
      .prepare("INSERT INTO sessions(token,user_id,expires,auth_version) SELECT ?,id,?,auth_version FROM users WHERE id=? AND auth_version=?")
      .bind(await hash(token), Date.now() + 7 * 86400000, id, version),
  ]);
  if (!result[2].meta.changes) throw new HttpError(401, "Your account changed. Please sign in again.");
  return cookie(req, token);
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
  const id = url.replace("/api/photo/", "");
  if (
    url != "/api/photo/" + id ||
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
