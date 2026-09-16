# Assbook 🍑

**The Bottom Line.** Good people. Bad puns. Great jeans.

An MIT-licensed social-network beta with one ridiculous premise: your profile
photo is your own fully clothed behind. No face recognition. Just hindsight.

## What works

- Handle/password accounts, sign-in, sign-out, and 30-day HttpOnly sessions.
- Persistent profiles, bios, and photo uploads.
- A chronological feed, following feed, search, and shareable post/profile links.
- Posts, replies, likes, bookmarks, follows, blocks, and post reports.
- An optional moderator queue for hiding reported posts.
- Responsive desktop/mobile UI, accessible dialogs, keyboard navigation.
- Downloadable source, generated from the same checkout.
- No AI API keys or paid third-party integrations required.

Demo profiles and posts are optional and clearly labeled. They cannot sign in.

## Stack

React + TypeScript + vinext (Next.js-compatible app routing), Cloudflare Workers,
D1 (SQLite), R2, Tailwind, Radix/Shadcn primitives, and Lucide icons.

The frontend and API run on one Cloudflare Worker. Static assets use Workers
Static Assets; the API uses D1 and R2 bindings. This checkout is prepared for
your own Cloudflare account and does not require OpenAI Sites hosting or
ChatGPT authentication.

## Local development

Requires Node.js 22.13+ and npm. Python 3 is used only for the optional source ZIP.

```sh
npm ci
npm run db:local
npm run db:seed     # optional fictional community examples
npm run dev
```

Open the Local URL printed by the server. Create a fresh account from “Join the
backside.” Local users, sessions, and photos stay in the ignored
`.wrangler/state` directory; they are never included in the source archive.

```sh
npm run typecheck
npm run build
ASSBOOK_TEST_URL=http://localhost:5174 npm run test:smoke
npm run source:zip
```

The smoke test accepts loopback URLs only, creates disposable accounts, checks
the actual API and storage behavior, and cleans up its accounts. Use the port
printed by your local server. Restart the preview after changing dependencies
or Cloudflare configuration.

## Deploy to your Cloudflare account

1. Run `npx wrangler login`.
2. Run `npx wrangler d1 create assbook`. Add the returned `database_id` to
   the `DB` entry in `wrangler.jsonc`.
3. Run `npx wrangler r2 bucket create assbook-photos`. If the name is already
   used in your account, choose another and update `bucket_name`.
4. Run `npm run db:remote` to apply the schema to your new database.
5. Optionally add the labeled demo content:
   `npx wrangler d1 execute DB --remote --config wrangler.jsonc --file db/seed.sql`.
6. Run `npm run source:zip`, then `npm run deploy`.
7. Open the Worker URL printed by Wrangler and create your own account.
8. Set `ADMIN_HANDLE` in `wrangler.jsonc` to that existing account's handle,
   then redeploy. The account menu will show the moderation queue.

Do not configure a moderator handle until you own that handle. Do not put
passwords or API tokens in `wrangler.jsonc`. Cloudflare access is managed by
Wrangler; application sessions use random tokens whose hashes are stored in D1.

The Vite plugin generates `dist/server/wrangler.json`; deploy that built
configuration. It connects the Worker to its generated static assets.
You can attach a custom domain through Cloudflare after deployment.
Create a dedicated database/bucket for each environment.

For Git-connected Workers Builds: use `npm run build` as the build command and
`npx wrangler deploy --config dist/server/wrangler.json` as the deploy command.
Run production migrations deliberately before deploying a schema change.
If you want the source-download button, generate the archive before the build,
or commit a release archive through your own release process.

## Beta boundaries

This is a working first version, not a claim of readiness for a mass launch.

- Photos require the uploader to attest ownership and clothing; there is **no
  automated image moderation**. Reports require an operator to review them.
- Configure a moderator and add an operational moderation process before
  inviting the public. Profile-photo reports are not yet a separate workflow.
- There is no password reset, email verification, account deletion UI, or
  two-factor authentication yet. Save your password.
- Passwords use salted PBKDF2-SHA-256 (100,000 iterations, the Web Crypto
  runtime-compatible value). Review stronger password hashing or an established
  identity provider before a large public launch.
- Same-origin write checks, bounded uploads, file-signature checks, ownership
  checks, hashed session tokens, and application rate limits are included.
  Add an edge bot challenge and tune limits for your deployment.
- Uploads are JPEG/PNG/WebP, at most 2 MB. Unattached uploads are visible only to
  their owner. The server does not strip EXIF metadata or scan image contents.
- Posts are soft-deleted. A cleanup/retention policy for uploads, reports, and
  inactive accounts is an operator decision.
- Feed pagination is a bounded offset implementation. Search is simple SQLite
  text matching; adapt these when you have enough real traffic to measure.
- No emails, private messaging, push notifications, or recommendation algorithm.

## Open source

The code is MIT-licensed. See LICENSE and CONTRIBUTING.md. Preserve the license
notices accompanying vendored components and the build helper.

The welcome photo is an AI-generated illustrative asset, not a photo of actual
community members. It was generated for this project with OpenAI image generation.

The downloaded source contains code and that demo asset, never local user data
or credentials. Set up your own database and bucket when self-hosting.

## Where things live

- `app/assbook.tsx`: the interactive social app.
- `app/globals.css`: visual system and responsive styles.
- `app/api/[...path]/route.ts`: HTTP API and permission checks.
- `lib/server.ts`: storage access, sessions, validation, rate limiting.
- `db/schema.ts`, `drizzle/`: database schema and immutable migrations.
- `db/seed.sql`: optional clearly labeled sample profiles/posts.
- `wrangler.jsonc`: Cloudflare source configuration.
- `scripts/smoke-test.mjs`: local API integration checks.

Official deployment reference:
[Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/).
