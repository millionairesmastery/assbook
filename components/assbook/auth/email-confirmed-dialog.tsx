"use client";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type EmailConfirmation =
  | { status: "working" }
  | { status: "ok"; signedIn: boolean }
  | { status: "error"; message: string };

// Result of opening a confirmation link. The link is submitted automatically
// when the page loads, so the member only ever sees the outcome.
export function EmailConfirmedDialog({
  state,
  onSignIn,
  onClose,
}: {
  state: EmailConfirmation;
  onSignIn: () => void;
  onClose: () => void;
}) {
  const title =
    state.status === "working"
      ? "Confirming your email…"
      : state.status === "ok"
        ? "Email confirmed. 🍑"
        : "That link did not work.";
  const description =
    state.status === "working"
      ? "Just a moment."
      : state.status === "ok"
        ? state.signedIn
          ? "You’re all set. Account recovery is on."
          : "You’re all set. Sign in to keep going."
        : state.message;
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && state.status !== "working" && onClose()}
    >
      <DialogContent className="assbook-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="form-stack">
          {state.status === "working" ? (
            <p className="muted small" role="status">
              <Loader2 className="spin" size={16} aria-hidden="true" /> Checking
              the link…
            </p>
          ) : state.status === "ok" && !state.signedIn ? (
            <button className="primary" onClick={onSignIn} autoFocus>
              Sign in
            </button>
          ) : (
            <button className="primary" onClick={onClose} autoFocus>
              {state.status === "ok" ? "Got it" : "Close"}
            </button>
          )}
          {state.status === "error" && (
            <p className="small muted">
              Links expire after 30 minutes. Sign in and request a new one from
              Account security.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
