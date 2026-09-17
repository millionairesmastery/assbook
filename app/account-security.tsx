"use client";
import { useEffect, useState } from "react";

async function request<T>(path: string, data?: unknown): Promise<T> {
  const res = await fetch("/api/auth/" + path, {
    method: data === undefined ? "GET" : "POST", credentials: "same-origin",
    headers: data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await res.json() as T & { error?: string };
  if (!res.ok) throw new Error(result.error || "Please try again.");
  return result;
}
function Password({ name = "currentPassword", fresh = false }: { name?: string; fresh?: boolean }) {
  return <label>{fresh ? "New password" : "Current password"}
    <input type="password" name={name} required minLength={fresh ? 15 : 1} maxLength={128}
      autoComplete={fresh ? "new-password" : "current-password"}
      placeholder={fresh ? "At least 15 characters" : "Your current password"} />
  </label>;
}
type Security = { email: string | null; pendingEmail: string | null; sessions: number };
export function AccountSecurity({ signedOut }: { signedOut: () => void }) {
  const [security, setSecurity] = useState<Security | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const refresh = async () => setSecurity(await request<Security>("security"));
  useEffect(() => { void refresh().catch(e => setError(e.message)); }, []);
  async function submit(form: HTMLFormElement, action: "email" | "password" | "revoke-sessions") {
    setBusy(true); setError(""); setMessage("");
    try {
      const data = Object.fromEntries(new FormData(form));
      if (action === "password" && data.password !== data.confirmPassword) throw new Error("The new passwords do not match.");
      const result = await request<{ message?: string }>(action, data);
      form.reset();
      if (action === "password") { signedOut(); return; }
      setMessage(result.message || "Other sessions are signed out. Unused account links have also been cancelled.");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="form-stack account-security">
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="security-notice" role="status">{message}</p>}
    {!security ? <p className="muted">Loading account settings…</p> : <>
      <section className="form-stack">
        <h3>Recovery email</h3>
        <p className="small">{security.email ? <>Verified: <b>{security.email}</b></> : "No verified recovery email yet. Verify your email so you can recover your account."}</p>
        {security.pendingEmail && <p className="security-notice">Check <b>{security.pendingEmail}</b> for a verification link. It expires after 30 minutes.</p>}
        <form className="form-stack" onSubmit={e => {e.preventDefault(); void submit(e.currentTarget,"email");}}>
          <label>{security.email ? "New recovery email" : "Your email"}<input name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={security.pendingEmail || ""} /></label>
          <Password />
          <button className="primary" disabled={busy}>Send verification email</button>
        </form>
      </section>
      <section className="form-stack">
        <h3>Change password</h3>
        <p className="small muted">Use a unique password or a few unrelated words. Changing it signs you out everywhere.</p>
        <form className="form-stack" onSubmit={e => {e.preventDefault(); void submit(e.currentTarget,"password");}}>
          <Password /><Password fresh name="password" />
          <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={15} maxLength={128} /></label>
          <button className="primary" disabled={busy}>Change password</button>
        </form>
      </section>
      <section className="form-stack">
        <h3>Signed-in sessions</h3>
        <p className="small muted">{security.sessions} active {security.sessions === 1 ? "session" : "sessions"}. Keep this session and sign out everywhere else.</p>
        <form className="form-stack" onSubmit={e => {e.preventDefault(); void submit(e.currentTarget,"revoke-sessions");}}>
          <Password /><button className="follow-button" disabled={busy}>Sign out other sessions</button>
        </form>
      </section>
    </>}
  </div>;
}
export function AccountRecovery({ mode, token, done, recover }: { mode: string; token: string; done: (message: string) => void; recover: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  async function submit(form: HTMLFormElement) {
    setBusy(true); setError("");
    try {
      const data = Object.fromEntries(new FormData(form));
      if (mode === "reset" && data.password !== data.confirmPassword) throw new Error("The new passwords do not match.");
      const result = await request<{message?: string}>(mode === "verify" ? "verify-email" : mode, { ...data, token });
      if (mode === "recover") setMessage(result.message || "Check your inbox.");
      else done(mode === "verify" ? "Recovery email verified. Please sign in again." : "Password reset. Please sign in with your new password.");
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <form className="form-stack" onSubmit={e => { e.preventDefault(); void submit(e.currentTarget); }}>
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="security-notice" role="status">{message}</p>}
    {mode === "recover" && <label>Your verified recovery email<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>}
    {mode === "reset" && <><Password fresh name="password" /><label>Confirm new password<input name="confirmPassword" type="password" minLength={15} maxLength={128} required autoComplete="new-password" /></label><p className="small muted">This signs out all existing sessions.</p></>}
    {mode === "verify" && <p>Only confirm if you requested this email for your own Assbook account. You’ll be asked to sign in again.</p>}
    <button className="primary" disabled={busy || !!message}>{busy ? "Please wait…" : mode === "verify" ? "Verify my email" : mode === "reset" ? "Reset password" : "Send recovery link"}</button>
    {mode !== "recover" && <button type="button" className="text-link" disabled={busy} onClick={recover}>Need a new link? Recover your account</button>}
    {mode === "recover" && <p className="small muted">Links expire after 20 minutes. Accounts without a verified email cannot use email recovery.</p>}
  </form>;
}
