"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { api, errorMessage, isAbortError } from "@/lib/api-client";
import type { Profile } from "@/lib/types";

type HandleReason = "taken" | "reserved" | "invalid";
type HandleCheck =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok"; handle: string }
  | { state: "no"; handle: string; reason: HandleReason };
type RemoteCheck = { handle: string; available: boolean; reason?: HandleReason };

const HANDLE_COPY: Record<"taken" | "reserved" | "invalid", string> = {
  taken: "is already taken. Try another.",
  reserved: "is reserved. Try another.",
  invalid: "needs 3 to 24 letters, numbers or underscores.",
};

export function AuthDialog({
  initialMode = "signup",
  onAuthenticated,
  onRecover,
  onOpenRules,
  onClose,
}: {
  initialMode?: "signup" | "login";
  onAuthenticated: (
    user: Profile | null,
    mode: "signup" | "login",
    email: string,
  ) => void;
  onRecover: () => void;
  onOpenRules: () => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"signup" | "login">(initialMode);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [handle, setHandle] = useState("");
  const [remote, setRemote] = useState<RemoteCheck | null>(null);
  const signup = mode === "signup";
  const value = handle.trim().toLowerCase();
  const shape: "idle" | "invalid" | "valid" = !value
    ? "idle"
    : /^[a-z0-9_]{3,24}$/.test(value)
      ? "valid"
      : "invalid";

  // Live availability while typing on signup: a short pause, one request,
  // stale answers ignored. The server checks again on submit anyway.
  useEffect(() => {
    if (!signup || shape !== "valid") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<{ available: boolean; reason?: HandleReason }>(
        "handle/" + encodeURIComponent(value),
        { signal: controller.signal },
      )
        .then((result) => setRemote({ handle: value, ...result }))
        .catch((cause: unknown) => {
          if (!isAbortError(cause)) setRemote(null);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, shape, signup]);

  const check: HandleCheck =
    shape === "idle"
      ? { state: "idle" }
      : shape === "invalid"
        ? { state: "no", handle: value, reason: "invalid" }
        : remote && remote.handle === value
          ? remote.available
            ? { state: "ok", handle: value }
            : { state: "no", handle: value, reason: remote.reason ?? "taken" }
          : { state: "checking" };
  const handleBlocked = signup && check.state === "no";

  const submit = async (form: HTMLFormElement) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = new FormData(form);
      await api(mode, {
        method: "POST",
        body: {
          email: data.get("email"),
          name: data.get("name"),
          handle: data.get("handle"),
          password: data.get("password"),
          rules: agreed,
        },
      });
      const fresh = await api<{ user: Profile | null }>("me");
      onAuthenticated(fresh.user, mode, String(data.get("email") ?? ""));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="assbook-dialog">
        <DialogHeader>
          <DialogTitle>
            {signup ? "Welcome to the backside." : "Look who’s back."}
          </DialogTitle>
          <DialogDescription>
            Good people. Bad puns. You’ll fit right in.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(event.currentTarget);
          }}
        >
          {signup && (
            <label>
              Your name
              <input
                name="name"
                required
                maxLength={40}
                autoComplete="name"
                placeholder="Jean Claude"
              />
            </label>
          )}
          {signup && (
            <label>
              Your email
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
          )}
          <label>
            Your handle
            <input
              name="handle"
              required
              minLength={3}
              maxLength={24}
              pattern="[a-zA-Z0-9_]{3,24}"
              autoComplete="username"
              placeholder="jeanclaude"
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              aria-describedby={signup ? "handle-status" : undefined}
              aria-invalid={handleBlocked || undefined}
            />
            {signup && (
              <span
                id="handle-status"
                className={
                  "handle-status " +
                  (check.state === "ok" ? "is-ok" : check.state === "no" ? "is-no" : "")
                }
                role="status"
              >
                {check.state === "checking" && (
                  <>
                    <Loader2 className="spin" size={13} aria-hidden="true" /> Checking…
                  </>
                )}
                {check.state === "ok" && (
                  <>
                    <Check size={13} aria-hidden="true" /> @{check.handle} is free. Your address
                    will be {typeof window === "undefined" ? "" : window.location.host}/@
                    {check.handle}
                  </>
                )}
                {check.state === "no" && (
                  <>
                    <X size={13} aria-hidden="true" /> @{check.handle} {HANDLE_COPY[check.reason]}
                  </>
                )}
                {check.state === "idle" && "Your handle is your address. It cannot be changed later."}
              </span>
            )}
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              required
              minLength={signup ? 15 : 1}
              maxLength={128}
              autoComplete={signup ? "new-password" : "current-password"}
              placeholder={signup ? "At least 15 characters" : "Your password"}
            />
          </label>
          {signup && (
            <>
              <label className="checkbox-line" htmlFor="community-rules">
                <Checkbox
                  id="community-rules"
                  checked={agreed}
                  onCheckedChange={(value) => setAgreed(value === true)}
                  aria-labelledby="community-rules-text"
                />
                <span id="community-rules-text">
                  I’m 18 or older, I’ll keep photos my own and fully clothed,
                  and I agree to the{" "}
                  <a href="/terms" target="_blank" rel="noreferrer">
                    Terms
                  </a>{" "}
                  and{" "}
                  <a href="/rules" target="_blank" rel="noreferrer">
                    Community rules
                  </a>
                  .
                </span>
              </label>
              <p className="small muted">
                We’ll send a verification link to enable account recovery. Your
                email is never shown on your profile.
              </p>
            </>
          )}
          <button className="primary" disabled={busy || (signup && (!agreed || handleBlocked))}>
            {busy && <Loader2 className="spin" size={17} aria-hidden="true" />}
            {signup ? "Join the backside" : "Sign in"}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="text-link centered"
            onClick={() => {
              setMode(signup ? "login" : "signup");
              setError("");
            }}
          >
            {signup ? "Already here? Sign in." : "New here? Grab a handle."}
          </button>
          {!signup && (
            <button
              type="button"
              className="text-link centered"
              onClick={onRecover}
            >
              Forgot your password?
            </button>
          )}
          <button className="small muted" type="button" onClick={onOpenRules}>
            Read the community rules
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
