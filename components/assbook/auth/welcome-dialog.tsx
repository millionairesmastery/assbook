"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Shown once, right after signup. One job: tell the new member to open the
// confirmation email. Everything else waits under Account security.
export function WelcomeDialog({
  email,
  onClose,
}: {
  email: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="assbook-dialog">
        <DialogHeader>
          <DialogTitle>You&rsquo;re in. 🍑</DialogTitle>
          <DialogDescription>
            One last thing so you can always get back into your account.
          </DialogDescription>
        </DialogHeader>
        <div className="form-stack">
          <p>
            We sent a confirmation link to <b>{email}</b>. Open it and
            you&rsquo;re all set.
          </p>
          <p className="small muted">
            The link expires in 30 minutes. Missed it? Account security can
            send a new one.
          </p>
          <button className="primary" onClick={onClose} autoFocus>
            Got it
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
