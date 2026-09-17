"use client";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CharCounter, useCharCounter } from "@/components/assbook/char-counter";
import { api, errorMessage } from "@/lib/api-client";
import type { Post } from "@/lib/types";

// Fix the words for a quarter of an hour after posting. The photo stays.
export function EditPostDialog({
  post,
  onSaved,
  onClose,
}: {
  post: Post;
  onSaved: (post: Post, body: string, editedAt: number) => void;
  onClose: () => void;
}) {
  const [body, setBody] = useState(post.body);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const counter = useCharCounter();
  const unchanged = body.trim() === post.body.trim();

  const save = async () => {
    if (busy || unchanged) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ edited_at: number }>("posts/" + post.id, {
        method: "PUT",
        body: { body },
      });
      onSaved(post, body.trim(), result.edited_at);
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="assbook-dialog">
        <DialogHeader>
          <DialogTitle>Second thoughts.</DialogTitle>
          <DialogDescription>
            You can edit the words for 15 minutes after posting. The photo stays.
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
            void save();
          }}
        >
          <label>
            <span className="label-row">
              Your post
              <CharCounter value={body} max={500} show={counter.focused} />
            </span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={500}
              rows={5}
              autoFocus
              {...counter.handlers}
            />
          </label>
          <button className="primary" disabled={busy || unchanged}>
            {busy ? (
              <Loader2 className="spin" size={16} aria-hidden="true" />
            ) : (
              <Check size={16} aria-hidden="true" />
            )}
            Save changes
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
