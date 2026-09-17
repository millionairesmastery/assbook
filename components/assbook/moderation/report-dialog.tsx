"use client";
import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CharCounter, useCharCounter } from "@/components/assbook/char-counter";
import { api, errorMessage } from "@/lib/api-client";

/**
 * One report form for anything a moderator can look at. The caller says where
 * it goes: "report/<post id>" for a post, "peeks/<peek id>/report" for a clip.
 */
export function ReportDialog({
  path,
  onClose,
}: {
  path: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const counter = useCharCounter();

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api(path, { method: "POST", body: { reason } });
      toast.success("Report saved for moderator review. Thank you.");
      onClose();
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
          <DialogTitle>Help keep it friendly.</DialogTitle>
          <DialogDescription>
            A moderator can review your report.
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
            void submit();
          }}
        >
          <label>
            <span className="label-row">
              What’s wrong?
              <CharCounter value={reason} max={250} show={counter.focused} />
            </span>
            <textarea
              name="reason"
              required
              maxLength={250}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Tell us what we should review."
              {...counter.handlers}
            />
          </label>
          <button className="primary" disabled={busy || !reason.trim()}>
            {busy && <Loader2 className="spin" size={15} aria-hidden="true" />}
            Send report <Flag size={16} aria-hidden="true" />
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
