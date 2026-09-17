# Account security

Report security issues through the repository host's private reporting channel.
Do not post credentials, recovery links, or real user data in public issues.

## Passwords and sessions

Passwords use scrypt with a unique random salt, N=16384, r=8, p=5, and a 32-byte
derived key. This is one of [OWASP's recommended scrypt profiles](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt).
The 16 MiB memory profile fits the Workers runtime. Legacy PBKDF2-SHA-256 hashes
are accepted and upgraded after successful authentication.

New passwords require 15–128 characters. Spaces are preserved; obvious repeated
or predictable passwords are rejected. This is a small predictability check,
not a comprehensive breached-password service.

Session tokens and account links each contain two cryptographically random UUIDs.
Only SHA-256 digests are stored in D1. Sessions last seven days and use HttpOnly,
SameSite=Lax cookies with Secure on HTTPS. Existing beta sessions retain their
original expiry until replaced or revoked.

## Recovery and email ownership

An email becomes a recovery address only after its verification link is confirmed.
Changing an email requires the current password; the previous recovery address
remains active until confirmation. Existing accounts can add an address from
Account security. Without a verified email, there is no email recovery path.

Recovery requests return the same message for known and unknown email addresses.
Requests are rate-limited by IP and normalized email; sign-in is also limited by
handle. Delivery timing may still vary with the email provider. These controls
do not replace edge bot protections or operational abuse monitoring.

Reset links expire after 20 minutes; verification links after 30 minutes. Their
secret is placed in a URL fragment, removed from the address bar by the client,
and submitted by a same-origin POST. Merely opening a link does not consume it.
Production links use the configured HTTPS APP_ORIGIN.

Atomic conditional database updates enforce expiry, purpose, ownership, and
single use. An account version invalidates old sessions and pending links after
password changes, email verification, or session revocation. A password reset
does not automatically sign in the browser.

If verification email cannot be sent during signup, the account is created and
the user is told to retry from Account security. Recovery delivery errors retain
the generic response. Logs include a failure event without recipient or token.

## Production requirements and remaining boundaries

- Configure and verify Cloudflare Email Sending and test real inbox delivery.
  Local bindings simulate email; their files and logs contain disposable links
  and must never be published.
- Apply migration `0001_solid_blue_blade.sql` before deploying this authentication
  code. Existing accounts are preserved and begin without a verified email.
- Protect operator accounts and configure an owned ADMIN_HANDLE.
- MFA, passkeys, account deletion, and detailed session history are not implemented.
- Photo ownership/clothing checks are uploader attestations plus manual reporting;
  uploads are not automatically moderated or stripped of metadata.
- No independent security audit or large-scale load test has been performed.

The local authentication integration test covers session invalidation, concurrent
reset replay, expiry, email verification, purpose separation, legacy password
upgrades, and per-account throttling. Run it alongside the existing social API test.
