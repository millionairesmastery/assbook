# Assbook 🍑

**The Bottom Line.** Good people. Bad puns. Great jeans.

An MIT-licensed social-network beta with one ridiculous premise: your profile
photo is your own fully clothed behind. No face recognition. Just hindsight.

## What works

- Handle/password accounts, sign-in, sign-out, and seven-day HttpOnly sessions.
- Verified recovery email, expiring password-reset links, password changes, and
  signing out other sessions. Email addresses stay off public profiles.
- Persistent profiles, bios, and photo uploads.
- A chronological feed, following feed, search, and shareable post/profile links.
- Posts, replies, likes, bookmarks, follows, blocks, and post reports. Replies
  can be removed by their author, the post owner, or the moderator.
- A moderator queue that groups reports by post, with hide and dismiss. One
  report per person per post.
- Responsive desktop/mobile UI, accessible dialogs, keyboard navigation, a
  mobile compose button, and security headers on every page.
- One-click email confirmation that keeps the confirming browser signed in.
- Automatic photo check before storage. Every upload is checked automatically with Workers AI (Llama 3.2 Vision) before it is stored: clear nudity is rejected, a profile photo that is clearly not a clothed behind is rejected, and anything the model is unsure about is stored but listed under "Photos to review" in the moderation queue, where the moderator can approve or remove it. `PHOTO_CHECK` in `wrangler.jsonc` turns this on, off, or into the test mode the smoke test uses. The check is a first line, not a guarantee; reports and the queue remain the real safety net.
  Self-hosters: Workers AI needs the `ai` binding in `wrangler.jsonc` and a
  one-time acceptance of the Llama 3.2 Vision licence (send the prompt `agree`
  to the model once from your account). Set `PHOTO_CHECK` to `off` to skip it.
- Downloadable source, generated from the same checkout.
- Local email simulation requires no service credentials. Live delivery uses
  Cloudflare Email Sending and requires sender-domain setup.

Demo profiles and posts are optional and clearly labeled. They cannot sign in.

## Stack

React + TypeScript + vinext (Next.js-compatible app routing), Cloudflare Workers,
D1 (SQLite), R2, Cloudflare Email Sending, Tailwind, Radix/Shadcn primitives, and Lucide icons.
The installed vinext version is 1.0.0-beta.5.

The frontend and API run on one Cloudflare Worker. Static assets use Workers
Static Assets; the API uses D1 and R2 bindings. This checkout is prepared for
your own Cloudflare account and does not require OpenAI Sites hosting or
ChatGPT authentication.

## Local development

Requires Node.js 22.13+ and npm. Python 3 is used for the optional source ZIP
and the authentication integration test's disposable database fixtures.

```sh
npm ci
npm run db:local
npm run db:seed     # optional fictional community examples
cp .dev.vars.example .dev.vars   # optional local moderator handle for tests
npm run dev
```

Open the Local URL printed by the server. Create a fresh account from “Join the
backside.” Local users, sessions, and photos stay in the ignored
`.wrangler/state` directory; they are never included in the source archive.

```sh
npm run typecheck
npm run lint
npm run build
ASSBOOK_TEST_URL=http://localhost:5174 npm run test:smoke
npm run source:zip
ASSBOOK_TEST_URL=http://localhost:5174 npm run test:auth
```

With `.dev.vars` in place, `ASSBOOK_ADMIN_HANDLE=test_mod_local npm run test:smoke`
also exercises the moderator queue with a disposable local account.

The smoke test accepts loopback URLs only, creates disposable accounts, checks
the actual API and storage behavior, and cleans up its accounts. Use the port
printed by your local server. Restart the preview after changing dependencies
or Cloudflare configuration.

Local verification/recovery emails are simulated. Wrangler prints paths to text
files under `.wrangler/tmp/email`; open a link from one of those files to verify
an email or reset a password. No email is sent to an actual inbox. Never enable
remote bindings when running the integration tests. The auth test checks expiry,
concurrent replay, session revocation, and legacy password upgrades.

## Deploy to your Cloudflare account

1. Run `npx wrangler login`.
2. Run `npx wrangler d1 create assbook`. Add the returned `database_id` to
   the `DB` entry in `wrangler.jsonc`.
3. Run `npx wrangler r2 bucket create assbook-photos`. If the name is already
   used in your account, choose another and update `bucket_name`.
4. Run `npm run db:remote` to apply the schema to your new database.
5. Optionally add the labeled demo content:
   `npx wrangler d1 execute DB --remote --config wrangler.jsonc --file db/seed.sql`.
6. Enable Cloudflare Email Sending for your own domain and verify its DNS records.
   Set `APP_ORIGIN` to the app's HTTPS address and `EMAIL_FROM` to a sender on
   that verified domain. The checked-in `.example` values are placeholders.
7. Run `npm run source:zip`, then `npm run deploy`.
8. Open your app, create an account, and test email verification and password
   recovery using a real mailbox you control.
9. Set `ADMIN_HANDLE` in `wrangler.jsonc` to that existing account's handle
   (lowercase), then redeploy. The account menu will show the moderation queue.
   While it is empty, reports are stored but nobody can read them.

There is no cron trigger. Expired sessions, limits, and links, and photos that
never became an avatar or a live post, are cleaned up after sign-ins. Deleting
a post or replacing an avatar removes the old photo from storage when nothing
else uses it.

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
- Existing accounts must add and verify a recovery email from Account security.
  Accounts without one cannot use email recovery. MFA/passkeys and account
  deletion are not implemented yet.
- Passwords use salted scrypt (N=16384, r=8, p=5). Legacy PBKDF2 passwords
  upgrade after successful sign-in. New passwords require 15 to 128 characters.
  See [SECURITY.md](SECURITY.md) for the security model and remaining boundaries.
- Apply all migrations before deploying: `0001_solid_blue_blade.sql` adds email,
  account versions, and recovery-token storage; `0002_warm_spitfire.sql` adds
  the indexes and the report constraint the code relies on. Neither removes
  existing users.
- Same-origin write checks, bounded uploads, file-signature checks, ownership
  checks, hashed session tokens, per-IP limits on public reads (tighter on
  search), and per-account write limits are included. Sign-in throttling counts
  failed attempts only. Add an edge bot challenge and tune limits for your
  deployment.
- Uploads are JPEG/PNG/WebP, at most 2 MB. Unattached uploads are visible only to
  their owner. The server does not strip EXIF metadata or scan image contents.
- Posts are soft-deleted. A cleanup/retention policy for uploads, reports, and
  inactive accounts is an operator decision.
- Feed pagination is keyset-based. Search is simple SQLite text matching;
  adapt it when you have enough real traffic to measure.
- No private messaging, push notifications, or recommendation algorithm.

## Open source

The code is MIT-licensed. See LICENSE and CONTRIBUTING.md. Preserve the license
notices accompanying vendored components and the build helper.

The welcome photo is an AI-generated illustrative asset, not a photo of actual
community members. It was generated for this project with OpenAI image generation.

The downloaded source contains code and that demo asset, never local user data
or credentials. Set up your own database and bucket when self-hosting.

## Where things live

- `app/assbook.tsx`: the app shell; `components/assbook/`: feed, composer,
  profile, people, auth, moderation, and dialog components; `hooks/`: viewer,
  feed, people, and profile state.
- `lib/api-client.ts`: the one fetch wrapper with friendly errors.
- `app/globals.css`: visual system and responsive styles.
- `middleware.ts`: security headers for pages.
- `app/api/[...path]/route.ts`: HTTP API and permission checks.
- `lib/server.ts`: storage access, sessions, validation, rate limiting.
- `lib/auth.ts`, `lib/password.ts`: recovery, email verification, password security.
- `app/account-security.tsx`: recovery and account-security screens.
- `db/schema.ts`, `drizzle/`: database schema and immutable migrations.
- `db/seed.sql`: optional clearly labeled sample profiles/posts.
- `wrangler.jsonc`: Cloudflare source configuration.
- `scripts/smoke-test.mjs`: local API integration checks.
- `scripts/auth-test.mjs`: local account-security integration checks.

Official deployment reference:
[Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/).
