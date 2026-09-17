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
function sqlLocal(sql) {
  const r = spawnSync(
    process.execPath,
    ["--import", "./scripts/sites-env.mjs", "./node_modules/wrangler/bin/wrangler.js", "d1", "execute", "DB", "--local", "--config", "wrangler.jsonc", "--persist-to", ".wrangler/state", "--command", sql],
    { stdio: "pipe" },
  );
  if (r.status !== 0) throw new Error("local SQL failed: " + sql);
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
      email: handles[i] + "@example.com",
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
  // Display names change once every 14 days; bio and photo stay free.
  assert.ok((await req(a, "me")).user.nameLockedUntil > Date.now());
  await req(a, "profile", "PUT", { name: "Too soon" }, 400);
  await req(a, "profile", "PUT", { name: "Updated test", bio: "Still on." });
  assert.equal((await req(a, "me")).user.bio, "Still on.");
  // Optional website link and the people typeahead.
  await req(a, "profile", "PUT", { link: "not a url" }, 400);
  await req(a, "profile", "PUT", { link: "https://example.com/pants" });
  assert.equal((await req(anon, "profile/" + handles[0])).profile.link, "https://example.com/pants");
  await req(a, "profile", "PUT", { link: "" });
  assert.equal((await req(anon, "profile/" + handles[0])).profile.link, null);
  assert.equal((await req(anon, "handle/" + handles[0])).available, false);
  assert.equal((await req(anon, "handle/" + handles[0])).reason, "taken");
  assert.equal((await req(anon, "handle/admin")).reason, "reserved");
  assert.equal((await req(anon, "handle/ab")).reason, "invalid");
  assert.equal((await req(anon, "handle/free_" + suffix)).available, true);
  const found = (await req(anon, "search/people?q=" + handles[0].slice(0, 6))).people;
  assert.ok(found.some((x) => x.id === au.id), "Typeahead finds a handle prefix");
  assert.equal((await req(anon, "search/people?q=")).people.length, 0);
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
  await req(b, "posts/" + p.id, "DELETE", undefined, 404);
  assert.equal((await req(anon, "feed?post=" + p.id)).posts.length, 1);
  await req(anon, "nonexistent", "GET", undefined, 404);
  await req(a, "comments", "GET", undefined, 404);
  await req(a, "like/not-a-uuid", "PUT", undefined, 404);
  pass(
    "Posts survive reload, share links resolve, other users cannot delete them, bad paths are 404s",
  );
  await req(b, "like/" + p.id, "PUT");
  await req(b, "like/" + p.id, "PUT");
  assert.equal((await req(b, "feed?post=" + p.id)).posts[0].likes, 1);
  await req(b, "save/" + p.id, "PUT");
  assert.equal((await req(b, "feed?filter=saved")).posts[0].id, p.id);
  assert.equal((await req(a, "feed?filter=saved")).posts.length, 0);
  await req(b, "follow/" + au.id, "PUT");
  assert.equal((await req(b, "feed?filter=following")).posts[0].id, p.id);
  const aProfile = (await req(anon, "profile/" + handles[0])).profile;
  assert.equal(aProfile.followers, 1);
  assert.equal(aProfile.following_count, 0);
  assert.equal(aProfile.posts_count, 1);
  assert.equal((await req(anon, "profile/" + handles[0] + "/followers")).people[0].id, bu.id);
  assert.equal((await req(anon, "profile/" + handles[1] + "/following")).people[0].id, au.id);
  assert.equal((await req(anon, "profile/" + handles[1] + "/followers")).people.length, 0);
  const top = (await req(anon, "top")).posts;
  assert.ok(top.some((x) => x.id === p.id), "A liked post shows in the top list");
  pass("Idempotent likes, private bookmarks, following feed, follower lists, profile counts, and top posts");
  await req(b, "comments/" + p.id, "POST", { body: "A test reply" }, 201);
  const replies = (await req(a, "comments/" + p.id)).comments;
  assert.equal(replies.length, 1);
  assert.equal(replies[0].user_id, bu.id);
  await req(b, "comments/" + p.id, "POST", { body: "A second reply" }, 201);
  const second = (await req(a, "comments/" + p.id)).comments[1];
  await req(a, "comments/" + second.id, "DELETE");
  await req(a, "comments/" + second.id, "DELETE", undefined, 404);
  await req(b, "comments/" + replies[0].id, "DELETE");
  assert.equal((await req(a, "comments/" + p.id)).comments.length, 0);
  await req(b, "comments/" + p.id, "POST", { body: "A test reply" }, 201);
  const own = (await req(a, "comments/" + p.id)).comments[0];
  await req(anon, "comments/" + own.id, "DELETE", undefined, 401);
  pass("Replies can be removed by their author or the post owner only");
  await req(
    b,
    "report/" + p.id,
    "POST",
    { reason: "Disposable test report" },
    201,
  );
  await req(
    b,
    "report/" + p.id,
    "POST",
    { reason: "Repeated test report" },
    201,
  );
  await req(b, "admin", "GET", undefined, 403);
  await req(b, "admin/" + p.id + "/dismiss", "POST", {}, 403);
  await req(b, "block/" + au.id, "PUT");
  assert.equal((await req(b, "feed?post=" + p.id)).posts.length, 0);
  assert.equal((await fetch(base + photo.url, { headers: { Cookie: b.cookie } })).status, 404);
  await req(b, "comments/" + p.id, "POST", { body: "Should fail" }, 404);
  await req(b, "block/" + au.id, "DELETE");
  assert.equal((await req(b, "feed?post=" + p.id)).posts.length, 1);
  assert.equal((await fetch(base + photo.url, { headers: { Cookie: b.cookie } })).status, 200);
  pass("Reports, moderator authorization, blocking hides posts and photos, and unblocking");
  const page = await req(anon, "feed?q=" + encodeURIComponent("%"));
  assert.equal(page.posts.length, 0, "LIKE wildcards are escaped");
  const first = await req(anon, "feed");
  assert.equal(typeof first.hasMore, "boolean");
  assert.ok(first.next === null || typeof first.next.created === "number");
  const cached = await fetch(base + photo.url, { headers: { Cookie: a.cookie } });
  const etag = cached.headers.get("etag");
  assert.ok(etag, "Photos carry an ETag");
  const revalidated = await fetch(base + photo.url, { headers: { Cookie: a.cookie, "If-None-Match": etag } });
  assert.equal(revalidated.status, 304);
  pass("Search wildcards, keyset pagination fields, and photo revalidation");
  // Moderation queue: only when the local server has ADMIN_HANDLE set to a
  // disposable handle (see .dev.vars.example). Production must never use it.
  const adminHandle = process.env.ASSBOOK_ADMIN_HANDLE;
  if (adminHandle) {
    const admin = { cookie: "" };
    handles.push(adminHandle);
    await req(admin, "signup", "POST", {
      name: "Local moderator",
      handle: adminHandle,
      password,
      email: adminHandle + "@example.com",
      rules: true,
    });
    assert.equal((await req(admin, "me")).user.isAdmin, true);
    const queue = (await req(admin, "admin")).reports;
    const item = queue.find((r) => r.post_id === p.id);
    assert.ok(item, "Reported post is in the queue");
    assert.equal(item.count, 1, "Repeated reports by one person count once");
    await req(admin, "admin/" + p.id + "/dismiss", "POST", {});
    assert.ok(!(await req(admin, "admin")).reports.some((r) => r.post_id === p.id));
    await req(b, "report/" + p.id, "POST", { reason: "Reported again" }, 201);
    assert.ok(!(await req(admin, "admin")).reports.some((r) => r.post_id === p.id), "A resolved report stays resolved");
    const p2 = await req(a, "posts", "POST", { body: "To be hidden " + suffix }, 201);
    await req(b, "report/" + p2.id, "POST", { reason: "Hide this" }, 201);
    await req(admin, "admin/" + p2.id, "DELETE");
    await req(admin, "admin/" + p2.id, "DELETE", undefined, 404);
    assert.equal((await req(anon, "feed?post=" + p2.id)).posts.length, 0);
    await req(admin, "comments/" + own.id, "DELETE");
    pass("Moderator queue groups reports, dismisses, hides posts, and removes replies");
    // Photo check (PHOTO_CHECK=test): rejected photos never land, unsure ones
    // are queued, and the moderator can approve or remove them.
    const testPng = png;
    await req(a, "upload", "POST", testPng, 400, {
      "X-Photo-Rules": "accepted",
      "Content-Type": "image/png",
      "X-Photo-Check-Test": "reject",
    });
    const flagged = await req(a, "upload", "POST", testPng, 201, {
      "X-Photo-Rules": "accepted",
      "Content-Type": "image/png",
      "X-Photo-Target": "avatar",
      "X-Photo-Check-Test": "flag",
    });
    assert.equal(flagged.flagged, true);
    const flaggedId = flagged.url.split("/").at(-1);
    await req(a, "profile", "PUT", { avatar: flagged.url });
    assert.equal((await fetch(base + flagged.url, { headers: { Cookie: admin.cookie } })).status, 200, "Moderator can view queued photos");
    const photoQueue = (await req(admin, "admin")).photos;
    const photoItem = photoQueue.find((x) => x.id === flaggedId);
    assert.ok(photoItem, "Unsure photo is in the queue");
    assert.equal(photoItem.target, "avatar");
    assert.equal(photoItem.in_use, 1);
    await req(admin, "admin/photo/" + flaggedId + "/approve", "POST", {});
    assert.ok(!(await req(admin, "admin")).photos.some((x) => x.id === flaggedId));
    await req(admin, "admin/photo/" + flaggedId + "/approve", "POST", {}, 404);
    await req(admin, "admin/photo/" + flaggedId, "DELETE");
    assert.equal((await req(a, "me")).user.avatar, null, "Removed photo is taken off the avatar");
    assert.equal((await fetch(base + flagged.url, { headers: { Cookie: a.cookie } })).status, 404);
    await req(a, "profile", "PUT", { avatar: photo.url });
    pass("Photo check rejects, queues unsure photos, and the moderator can approve or remove them");
    // Official account (the moderator handle): cannot be blocked or reported,
    // can pin posts to the top of the main feed.
    const adminUser = (await req(admin, "me")).user;
    const welcome = await req(admin, "posts", "POST", { body: "Welcome to the backside " + suffix }, 201);
    await req(b, "report/" + welcome.id, "POST", { reason: "Nope" }, 400);
    await req(b, "block/" + adminUser.id, "PUT", undefined, 400);
    const later = await req(a, "posts", "POST", { body: "Newer than the welcome " + suffix }, 201);
    assert.equal((await req(anon, "feed")).posts[0].id, later.id, "Unpinned welcome sorts by time");
    assert.equal((await req(admin, "admin/pin/" + welcome.id, "POST", {})).pinned, true);
    const withPin = (await req(anon, "feed")).posts;
    assert.equal(withPin[0].id, welcome.id, "Pinned post comes first");
    assert.equal(withPin[0].pinned, 1);
    assert.equal(withPin[0].official, 1);
    assert.equal(withPin.filter((x) => x.id === welcome.id).length, 1, "Pinned post appears once");
    const followingPin = (await req(b, "feed?filter=following")).posts;
    assert.equal(followingPin[0]?.id, welcome.id, "Pinned post tops the Following tab for a newcomer");
    assert.equal(followingPin.filter((x) => x.id === welcome.id).length, 1);
    // A member past their first week sees the pinned post in its normal place.
    sqlLocal("UPDATE users SET created=" + (Date.now() - 8 * 86400000) + " WHERE handle='" + handles[0] + "'");
    const settled = (await req(a, "feed")).posts;
    assert.equal(settled[0]?.id, later.id, "Settled members see the timeline order");
    assert.ok(settled.some((x) => x.id === welcome.id), "The pinned post is still in the feed");
    assert.equal((await req(admin, "admin/pin/" + welcome.id, "POST", {})).pinned, false);
    await req(a, "admin/pin/" + welcome.id, "POST", {}, 403);
    const adminProfile = (await req(anon, "profile/" + adminUser.handle)).profile;
    assert.equal(adminProfile.official, 1);
    assert.equal(adminProfile.posts_count, 1);
    pass("Official account cannot be blocked or reported; pins sit first in the main feed");
    // Onboarding: the official account is suggested first, and "done" needs
    // the required number of follows (3, or everyone while the site is small).
    const fresh = { cookie: "" };
    const freshHandle = "test_c_" + suffix;
    handles.push(freshHandle);
    await req(fresh, "signup", "POST", { name: "Local test c", handle: freshHandle, password, email: freshHandle + "@example.com", rules: true });
    assert.equal((await req(fresh, "me")).user.onboarded, false);
    const suggested = await req(fresh, "suggestions");
    assert.equal(suggested.people[0].id, adminUser.id, "Official account is suggested first");
    assert.ok(suggested.required >= 1 && suggested.required <= 3);
    await req(fresh, "onboarding/done", "POST", {}, 400);
    for (const person of suggested.people.slice(0, suggested.required)) await req(fresh, "follow/" + person.id, "PUT");
    assert.equal((await req(fresh, "suggestions")).following, suggested.required);
    await req(fresh, "onboarding/done", "POST", {});
    assert.equal((await req(fresh, "me")).user.onboarded, true);
    pass("Onboarding suggests the official account first and completes after the required follows");
    await req(a, "posts/" + later.id, "DELETE");
  } else console.log("SKIP moderator queue (set ASSBOOK_ADMIN_HANDLE and ADMIN_HANDLE in .dev.vars)");
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
