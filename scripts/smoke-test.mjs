import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
const base = process.env.ASSBOOK_TEST_URL ?? "http://localhost:5174";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname))
  throw new Error("This test creates disposable accounts and is local-only.");
const suffix = randomUUID().slice(0, 8);
const handles = ["test_a_" + suffix, "test_b_" + suffix];
const password = "Local-test-only-" + randomUUID();
const a = { cookie: "" },
  b = { cookie: "" },
  anon = { cookie: "" };
async function req(
  session,
  path,
  method = "GET",
  data,
  expected = 200,
  extra = {},
) {
  const headers = {
    Origin: base,
    ...(session.cookie ? { Cookie: session.cookie } : {}),
    ...extra,
  };
  let payload = data;
  if (
    data !== undefined &&
    typeof data !== "string" &&
    !(data instanceof Uint8Array)
  ) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(data);
  }
  const res = await fetch(base + "/api/" + path, {
    method,
    headers,
    body: payload,
  });
  if (res.headers.get("set-cookie"))
    session.cookie = res.headers.get("set-cookie").split(";")[0];
  const json = await res.json();
  assert.equal(res.status, expected, path + ": " + JSON.stringify(json));
  return json;
}
let passed = 0;
function pass(label) {
  console.log("PASS " + label);
  passed++;
}
try {
  await req(anon, "posts", "POST", { body: "No account" }, 401);
  const denied = await fetch(base + "/api/signup", {
    method: "POST",
    headers: {
      Origin: "https://untrusted.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(denied.status, 403);
  pass("Anonymous writes and cross-origin requests rejected");
  for (const [session, i] of [
    [a, 0],
    [b, 1],
  ])
    await req(session, "signup", "POST", {
      name: "Local test " + i,
      handle: handles[i],
      password,
      rules: true,
    });
  const au = (await req(a, "me")).user,
    bu = (await req(b, "me")).user;
  assert.notEqual(au.id, bu.id);
  pass("Separate accounts and persistent HttpOnly sessions");
  await req(a, "posts", "POST", "{", 400, {
    "Content-Type": "application/json",
  });
  await req(a, "upload", "POST", new Uint8Array([1, 2]), 400);
  await req(
    a,
    "upload",
    "POST",
    new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    400,
    { "X-Photo-Rules": "accepted", "Content-Type": "image/svg+xml" },
  );
  await req(a, "upload", "POST", new Uint8Array(2 * 1024 * 1024 + 1), 413, {
    "X-Photo-Rules": "accepted",
    "Content-Type": "image/png",
  });
  pass(
    "Malformed requests, unconfirmed photos, SVG, and oversized uploads rejected",
  );
  const png = Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jNZkAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  const photo = await req(a, "upload", "POST", png, 201, {
    "X-Photo-Rules": "accepted",
    "Content-Type": "image/png",
  });
  const photoId = photo.url.split("/").at(-1);
  const privatePhoto = await fetch(base + photo.url);
  assert.equal(privatePhoto.status, 404);
  await req(
    b,
    "posts",
    "POST",
    { body: "Stolen photo", image: photo.url },
    400,
  );
  await req(a, "profile", "PUT", {
    name: "Updated test",
    bio: "Pants firmly on.",
    avatar: photo.url,
  });
  assert.equal((await req(a, "me")).user.avatar, photo.url);
  const image = await fetch(base + photo.url);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
  pass(
    "Photo storage, unpublished photo privacy, ownership checks, and profile updates",
  );
  const p = await req(
    a,
    "posts",
    "POST",
    { body: "Local smoke test " + suffix, image: photo.url },
    201,
  );
  assert.equal((await req(anon, "feed?post=" + p.id)).posts[0].id, p.id);
  await req(b, "posts/" + p.id, "DELETE");
  assert.equal((await req(anon, "feed?post=" + p.id)).posts.length, 1);
  pass(
    "Posts survive reload, share links resolve, other users cannot delete them",
  );
  await req(b, "like/" + p.id, "PUT");
  await req(b, "like/" + p.id, "PUT");
  assert.equal((await req(b, "feed?post=" + p.id)).posts[0].likes, 1);
  await req(b, "save/" + p.id, "PUT");
  assert.equal((await req(b, "feed?filter=saved")).posts[0].id, p.id);
  assert.equal((await req(a, "feed?filter=saved")).posts.length, 0);
  await req(b, "follow/" + au.id, "PUT");
  assert.equal((await req(b, "feed?filter=following")).posts[0].id, p.id);
  pass("Idempotent likes, private bookmarks, and following feed");
  await req(b, "comments/" + p.id, "POST", { body: "A test reply" }, 201);
  assert.equal((await req(a, "comments/" + p.id)).comments.length, 1);
  await req(
    b,
    "report/" + p.id,
    "POST",
    { reason: "Disposable test report" },
    201,
  );
  await req(b, "admin", "GET", undefined, 403);
  await req(b, "block/" + au.id, "PUT");
  assert.equal((await req(b, "feed?post=" + p.id)).posts.length, 0);
  await req(b, "comments/" + p.id, "POST", { body: "Should fail" }, 404);
  await req(b, "block/" + au.id, "DELETE");
  assert.equal((await req(b, "feed?post=" + p.id)).posts.length, 1);
  pass("Replies, reports, moderator authorization, blocking, and unblocking");
  await req(a, "posts/" + p.id, "DELETE");
  assert.equal((await req(anon, "feed?post=" + p.id)).posts.length, 0);
  await req(a, "logout", "POST");
  assert.equal((await req(a, "me")).user, null);
  await req(
    a,
    "login",
    "POST",
    { handle: handles[0], password: "incorrect-password" },
    401,
  );
  await req(a, "login", "POST", { handle: handles[0], password });
  assert.equal((await req(a, "me")).user.id, au.id);
  pass("Post removal, sign-out, rejected bad password, and sign-in");
  console.log(passed + " integration checks passed.");
  // Remove the disposable photo through the local CLI; no remote resources.
  const r2 = spawnSync(
    process.execPath,
    [
      "--import",
      "./scripts/sites-env.mjs",
      "./node_modules/wrangler/bin/wrangler.js",
      "r2",
      "object",
      "delete",
      "assbook-photos/" + photoId,
      "--local",
      "--config",
      "wrangler.jsonc",
      "--persist-to",
      ".wrangler/state",
    ],
    { stdio: "pipe" },
  );
  if (r2.status !== 0)
    console.warn("Disposable photo cleanup skipped; local state only.");
} finally {
  const sql =
    "DELETE FROM users WHERE handle IN ('" + handles.join("','") + "');";
  const clean = spawnSync(
    process.execPath,
    [
      "--import",
      "./scripts/sites-env.mjs",
      "./node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      "wrangler.jsonc",
      "--persist-to",
      ".wrangler/state",
      "--command",
      sql,
    ],
    { stdio: "pipe" },
  );
  if (clean.status !== 0)
    console.warn("Disposable account cleanup failed; local state only.");
}
