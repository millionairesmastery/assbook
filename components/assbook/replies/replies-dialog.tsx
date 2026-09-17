"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/assbook/avatar";
import { CharCounter, useCharCounter } from "@/components/assbook/char-counter";
import { api, errorMessage, isAbortError } from "@/lib/api-client";
import { age } from "@/lib/format";
import type { Comment, Post, Profile } from "@/lib/types";

export function RepliesDialog({
  post,
  viewer,
  now,
  onCountChange,
  onRequireUser,
  onClose,
}: {
  post: Post;
  viewer: Profile | null;
  now: number;
  onCountChange: (postId: string, count: number) => void;
  onRequireUser: () => boolean;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [removing, setRemoving] = useState("");
  const counter = useCharCounter();

  useEffect(() => {
    const controller = new AbortController();
    api<{ comments: Comment[] }>("comments/" + post.id, {
      signal: controller.signal,
    })
      .then((data) => {
        setComments(data.comments);
        setError("");
        setLoaded(true);
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setError(errorMessage(cause));
        setLoaded(true);
      });
    return () => controller.abort();
  }, [post.id, attempt]);

  const reload = useCallback(async () => {
    const data = await api<{ comments: Comment[] }>("comments/" + post.id);
    setComments(data.comments);
    onCountChange(post.id, data.comments.length);
  }, [post.id, onCountChange]);

  const send = async () => {
    if (sending || !onRequireUser()) return;
    setSending(true);
    try {
      await api("comments/" + post.id, { method: "POST", body: { body: reply } });
      setReply("");
      await reload();
    } catch (cause) {
      toast.error(errorMessage(cause));
    } finally {
      setSending(false);
    }
  };

  const remove = async (comment: Comment) => {
    setRemoving(comment.id);
    try {
      await api("comments/" + comment.id, { method: "DELETE" });
      // Update the parent's count outside the state updater, which React runs
      // during render.
      const next = comments.filter((item) => item.id !== comment.id);
      setComments(next);
      onCountChange(post.id, next.length);
      toast.success("Reply removed.");
    } catch (cause) {
      toast.error(errorMessage(cause));
    } finally {
      setRemoving("");
    }
  };

  const canRemove = (comment: Comment) =>
    !!viewer &&
    (viewer.id === comment.user_id ||
      viewer.id === post.user_id ||
      !!viewer.isAdmin);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="assbook-dialog">
        <DialogHeader>
          <DialogTitle>Behind the scenes.</DialogTitle>
          <DialogDescription>
            Add something kind. Or a truly terrible pun.
          </DialogDescription>
        </DialogHeader>
        <p className="reply-original">{post.body}</p>
        <div className="comment-list">
          {error ? (
            <div className="form-error" role="alert">
              <p>{error}</p>
              <button
                className="quiet"
                onClick={() => {
                  setError("");
                  setAttempt((n) => n + 1);
                }}
              >
                <RefreshCw size={15} aria-hidden="true" />
                Try again
              </button>
            </div>
          ) : !loaded ? (
            <p className="muted small" role="status">
              <Loader2 className="spin" size={16} aria-hidden="true" /> Reading
              the replies…
            </p>
          ) : comments.length === 0 ? (
            <p className="muted small">Be the first to get behind this.</p>
          ) : (
            comments.map((comment) => (
              <div className="comment" key={comment.id}>
                <Avatar person={comment} />
                <div>
                  <b>{comment.name}</b>
                  <span className="person-meta">
                    @{comment.handle} · {age(comment.created, now)}
                  </span>
                  <p>{comment.body}</p>
                </div>
                {canRemove(comment) && (
                  <button
                    className="icon-button"
                    disabled={removing === comment.id}
                    onClick={() => void remove(comment)}
                    aria-label={"Remove reply by " + comment.name}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
        <form
          className="reply-form"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label className="reply-field">
            <span className="sr-only">Your reply</span>
            <input
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              maxLength={280}
              placeholder="A kind word. A bad pun."
              required
              {...counter.handlers}
            />
            <CharCounter value={reply} max={280} show={counter.focused} />
          </label>
          <button
            className="primary"
            disabled={sending || !reply.trim()}
            aria-label="Send reply"
          >
            {sending ? (
              <Loader2 className="spin" size={17} aria-hidden="true" />
            ) : (
              <Send size={17} aria-hidden="true" />
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
