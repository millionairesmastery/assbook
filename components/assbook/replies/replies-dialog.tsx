"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Heart,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/assbook/avatar";
import { NameBadge } from "@/components/assbook/account-badge";
import { CharCounter, useCharCounter } from "@/components/assbook/char-counter";
import { MentionField } from "@/components/assbook/mention-field";
import { MentionText } from "@/components/assbook/mention-text";
import { api, errorMessage, isAbortError } from "@/lib/api-client";
import { age } from "@/lib/format";
import type { Comment, Post, Profile } from "@/lib/types";

// Threads longer than this fold behind "View replies".
const FOLD_AT = 2;

/**
 * Replies on a post. A reply can be liked and answered; answers sit one level
 * under it, folded when there are many. @handles link to profiles and offer
 * people while you type.
 */
export function RepliesDialog({
  post,
  viewer,
  now,
  onCountChange,
  onRequireUser,
  onVisitProfile,
  onClose,
}: {
  post: Post;
  viewer: Profile | null;
  now: number;
  onCountChange: (postId: string, count: number) => void;
  onRequireUser: () => boolean;
  onVisitProfile: (handle: string) => void;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [reply, setReply] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);
  const [removing, setRemoving] = useState("");
  const [liking, setLiking] = useState("");
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const field = useRef<HTMLTextAreaElement | null>(null);
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
      await api("comments/" + post.id, {
        method: "POST",
        body: { body: reply, parent: replyTo?.id },
      });
      setReply("");
      if (replyTo) {
        const thread = replyTo.parent_id ?? replyTo.id;
        setOpen((current) => new Set(current).add(thread));
      }
      setReplyTo(null);
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
      // A removed reply takes its thread with it.
      const next = comments.filter(
        (item) => item.id !== comment.id && item.parent_id !== comment.id,
      );
      setComments(next);
      onCountChange(post.id, next.length);
      toast.success("Reply removed.");
    } catch (cause) {
      toast.error(errorMessage(cause));
    } finally {
      setRemoving("");
    }
  };

  const like = async (comment: Comment) => {
    if (liking || !onRequireUser()) return;
    const next = comment.liked ? 0 : 1;
    const step = next ? 1 : -1;
    setLiking(comment.id);
    setComments((current) =>
      current.map((item) =>
        item.id === comment.id ? { ...item, liked: next, likes: item.likes + step } : item,
      ),
    );
    try {
      const result = await api<{ likes: number }>("comment-like/" + comment.id, {
        method: next ? "PUT" : "DELETE",
      });
      setComments((current) =>
        current.map((item) => (item.id === comment.id ? { ...item, likes: result.likes } : item)),
      );
    } catch (cause) {
      setComments((current) =>
        current.map((item) =>
          item.id === comment.id ? { ...item, liked: comment.liked, likes: comment.likes } : item,
        ),
      );
      toast.error(errorMessage(cause));
    } finally {
      setLiking("");
    }
  };

  // "Reply" puts the handle in the field, the Instagram way, and keeps the
  // answer inside that thread.
  const answer = (comment: Comment) => {
    if (!onRequireUser()) return;
    setReplyTo(comment);
    setReply((current) => {
      const tag = "@" + comment.handle + " ";
      return current.startsWith(tag) ? current : tag + current.replace(/^@[a-z0-9_]+\s*/i, "");
    });
    requestAnimationFrame(() => {
      const node = field.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(node.value.length, node.value.length);
    });
  };

  const canRemove = (comment: Comment) =>
    !!viewer &&
    (viewer.id === comment.user_id ||
      viewer.id === post.user_id ||
      !!viewer.isAdmin);

  const tops = comments.filter((item) => !item.parent_id);
  const repliesOf = (id: string) => comments.filter((item) => item.parent_id === id);

  const row = (comment: Comment) => (
    <div className="comment" key={comment.id}>
      <button
        className="comment-avatar"
        onClick={() => onVisitProfile(comment.handle)}
        aria-label={"View " + comment.name}
      >
        <Avatar person={comment} />
      </button>
      <div className="comment-body">
        <b className="name-line">
          <button className="comment-name" onClick={() => onVisitProfile(comment.handle)}>
            {comment.name}
          </button>
          <NameBadge person={comment} />
        </b>
        <span className="person-meta">
          @{comment.handle} · {age(comment.created, now)}
        </span>
        <p>
          <MentionText text={comment.body} onVisit={onVisitProfile} />
        </p>
        <div className="comment-actions">
          <button
            className={comment.liked ? "selected" : ""}
            disabled={liking === comment.id}
            onClick={() => void like(comment)}
            aria-pressed={!!comment.liked}
            aria-label={(comment.liked ? "Unlike" : "Like") + " reply by " + comment.name}
          >
            <Heart size={14} aria-hidden="true" fill={comment.liked ? "currentColor" : "none"} />
            {comment.likes > 0 && <span>{comment.likes}</span>}
          </button>
          <button onClick={() => answer(comment)} aria-label={"Reply to " + comment.name}>
            <MessageCircle size={14} aria-hidden="true" />
            Reply
          </button>
          {canRemove(comment) && (
            <button
              disabled={removing === comment.id}
              onClick={() => void remove(comment)}
              aria-label={"Remove reply by " + comment.name}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="assbook-dialog">
        <DialogHeader>
          <DialogTitle>Behind the scenes.</DialogTitle>
          <DialogDescription>
            Add something kind. Or a truly terrible pun.
          </DialogDescription>
        </DialogHeader>
        <p className="reply-original">
          <MentionText text={post.body} onVisit={onVisitProfile} />
        </p>
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
          ) : tops.length === 0 ? (
            <p className="muted small">Be the first to get behind this.</p>
          ) : (
            tops.map((top) => {
              const thread = repliesOf(top.id);
              const shown = thread.length <= FOLD_AT || open.has(top.id);
              return (
                <div className="comment-thread" key={top.id}>
                  {row(top)}
                  {thread.length > 0 && shown && (
                    <div className="comment-replies">{thread.map(row)}</div>
                  )}
                  {thread.length > FOLD_AT && (
                    <button
                      className="comment-toggle"
                      onClick={() =>
                        setOpen((current) => {
                          const next = new Set(current);
                          if (next.has(top.id)) next.delete(top.id);
                          else next.add(top.id);
                          return next;
                        })
                      }
                    >
                      {shown ? (
                        <>
                          <ChevronUp size={14} aria-hidden="true" /> Hide replies
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} aria-hidden="true" /> View {thread.length} replies
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
        {replyTo && (
          <p className="replying-to">
            Replying to <b>@{replyTo.handle}</b>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="Reply to the post instead"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </p>
        )}
        <form
          className="reply-form"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label className="reply-field">
            <span className="sr-only">Your reply</span>
            <MentionField
              value={reply}
              onChange={setReply}
              fieldRef={field}
              menu="above"
              maxLength={280}
              placeholder={replyTo ? "Your answer" : "A kind word. A bad pun."}
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
