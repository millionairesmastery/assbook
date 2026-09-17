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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar } from "@/components/assbook/avatar";
import { CharCounter, useCharCounter } from "@/components/assbook/char-counter";
import { useIsMobile } from "@/hooks/use-mobile";
import { api, errorMessage, isAbortError } from "@/lib/api-client";
import { age } from "@/lib/format";
import type { Peek, PeekReply, Profile } from "@/lib/types";

/**
 * Replies to one peek: a sheet up from the bottom on a phone, a dialog on a
 * desktop. Same shape as the replies on a post, one endpoint along.
 */
export function PeekReplies({
  peek,
  viewer,
  now,
  onCountChange,
  onClose,
}: {
  peek: Peek;
  viewer: Profile | null;
  now: number;
  onCountChange: (peekId: string, count: number) => void;
  onClose: () => void;
}) {
  const mobile = useIsMobile();
  const [replies, setReplies] = useState<PeekReply[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [removing, setRemoving] = useState("");
  const counter = useCharCounter();

  useEffect(() => {
    const controller = new AbortController();
    api<{ replies: PeekReply[] }>("peeks/" + peek.id + "/replies", {
      signal: controller.signal,
    })
      .then((data) => {
        setReplies(data.replies);
        setError("");
        setLoaded(true);
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setError(errorMessage(cause));
        setLoaded(true);
      });
    return () => controller.abort();
  }, [peek.id, attempt]);

  const reload = useCallback(async () => {
    const data = await api<{ replies: PeekReply[] }>(
      "peeks/" + peek.id + "/replies",
    );
    setReplies(data.replies);
    onCountChange(peek.id, data.replies.length);
  }, [peek.id, onCountChange]);

  const send = async () => {
    if (sending || !reply.trim()) return;
    setSending(true);
    try {
      await api("peeks/" + peek.id + "/replies", {
        method: "POST",
        body: { body: reply },
      });
      setReply("");
      await reload();
    } catch (cause) {
      toast.error(errorMessage(cause));
    } finally {
      setSending(false);
    }
  };

  const remove = async (item: PeekReply) => {
    setRemoving(item.id);
    try {
      await api("peeks/" + peek.id + "/replies/" + item.id, {
        method: "DELETE",
      });
      const next = replies.filter((one) => one.id !== item.id);
      setReplies(next);
      onCountChange(peek.id, next.length);
      toast.success("Reply removed.");
    } catch (cause) {
      toast.error(errorMessage(cause));
    } finally {
      setRemoving("");
    }
  };

  const canRemove = (item: PeekReply) =>
    !!viewer &&
    (viewer.id === item.user_id ||
      viewer.id === peek.creator.id ||
      !!viewer.isAdmin);

  const body = (
    <>
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
            <Loader2 className="spin" size={16} aria-hidden="true" /> Reading the
            replies…
          </p>
        ) : replies.length === 0 ? (
          <p className="muted small">
            Nothing yet. Five seconds deserve a few words.
          </p>
        ) : (
          replies.map((item) => (
            <div className="comment" key={item.id}>
              <Avatar person={item} />
              <div>
                <b>{item.name}</b>
                <span className="person-meta">
                  @{item.handle} · {age(item.created, now)}
                </span>
                <p>{item.body}</p>
              </div>
              {canRemove(item) && (
                <button
                  className="icon-button"
                  disabled={removing === item.id}
                  onClick={() => void remove(item)}
                  aria-label={"Remove reply by " + item.name}
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
            placeholder="Say something nice about those five seconds."
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
    </>
  );

  const title = "Five seconds, many opinions.";
  const description = "Replies stay after the clip has gone.";

  return mobile ? (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="bottom" className="peek-sheet">
        <SheetHeader className="peek-sheet-head">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  ) : (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="assbook-dialog peek-replies-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
