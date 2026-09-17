"use client";
import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/assbook/avatar";
import { NameBadge } from "@/components/assbook/account-badge";
import { api, errorMessage, isAbortError } from "@/lib/api-client";
import { age } from "@/lib/format";
import type { Notification } from "@/lib/types";

type Page = { items: Notification[]; unread: number };

// The words after the name, per kind of thing that happened.
function said(item: Notification): string {
  switch (item.kind) {
    case "follow":
      return "followed you.";
    case "like":
      return "liked your post.";
    case "comment":
      return "replied to your post:";
    case "peek_like":
      return "liked your peek.";
    case "peek_reply":
      return "replied to your peek:";
    case "repeek":
      return "re-peeked your peek.";
    default:
      return "";
  }
}

/**
 * Everything that happened to you lately, newest first. Opening the list is
 * what marks it read: the bell stops counting, the unread rows stay tinted
 * until the next visit so it is still clear what is new.
 */
export function NotificationsDialog({
  now,
  onLoaded,
  onOpen,
  onClose,
}: {
  now: number;
  onLoaded: () => void;
  onOpen: (item: Notification) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api<Page>("notifications", { signal: controller.signal })
      .then((data) => {
        setItems(data.items);
        setError("");
        setLoaded(true);
        if (data.unread > 0) onLoaded();
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setError(errorMessage(cause));
        setLoaded(true);
      });
    return () => controller.abort();
    // onLoaded is stable; the list is fetched once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="assbook-dialog">
        <DialogHeader>
          <DialogTitle>Behind your back.</DialogTitle>
          <DialogDescription>
            Follows, likes and replies from the last two months.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="form-error" role="alert">
            <p>{error}</p>
            <button
              className="quiet"
              onClick={() => {
                setError("");
                setLoaded(false);
                setAttempt((n) => n + 1);
              }}
            >
              <RefreshCw size={15} aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : !loaded ? (
          <p className="muted" role="status">
            <Loader2 className="spin" size={18} aria-hidden="true" /> Looking
            over your shoulder…
          </p>
        ) : items.length === 0 ? (
          <p className="muted">
            Nothing yet. Post something, follow a few people, and this fills up.
          </p>
        ) : (
          <ul className="notice-list" aria-label="Notifications">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  className={"notice-row" + (item.read ? "" : " unread")}
                  onClick={() => onOpen(item)}
                >
                  {item.actor ? (
                    <Avatar person={item.actor} />
                  ) : (
                    <span className="notice-crew" aria-hidden="true">
                      🍑
                    </span>
                  )}
                  <span className="notice-text">
                    {item.actor ? (
                      <>
                        <b className="name-line">
                          <span className="name-text">{item.actor.name}</span>
                          <NameBadge person={item.actor} />
                        </b>{" "}
                        {said(item)}
                        {item.body && (
                          <>
                            {" "}
                            <q>{item.body}</q>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <b>The Assbook crew</b> {item.body}
                      </>
                    )}
                  </span>
                  <span className="notice-when">{age(item.created, now)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
