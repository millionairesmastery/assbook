import { NextResponse } from "next/server";
// Security headers for the app shell. API responses set their own headers in
// lib/server.ts, and photos carry a sandboxing policy of their own.
// React needs eval() for its development-only debugging features. Production
// never gets it.
const scriptSrc =
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
export function middleware() {
  const res = NextResponse.next();
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
    ].join("; "),
  );
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "same-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=15552000; includeSubDomains",
  );
  return res;
}
export const config = { matcher: ["/((?!api/|_next/).*)"] };
