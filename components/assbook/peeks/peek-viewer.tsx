"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Eye,
  Flag,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Repeat,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/assbook/avatar";
import { NameBadge } from "@/components/assbook/account-badge";
import { ConfirmDialog } from "@/components/assbook/confirm-dialog";
import { ReportDialog } from "@/components/assbook/moderation/report-dialog";
import { PeekReplies } from "@/components/assbook/peeks/peek-replies";
import { useAsyncAction } from "@/hooks/use-async-action";
import { api } from "@/lib/api-client";
import { age, plural } from "@/lib/format";
import type { Peek, PeekPerson, Profile } from "@/lib/types";

// A clip runs for up to ten seconds. Used for the progress bar until the browser
// has told us what the file really holds.
const CLIP_MS = 10000;
// Sound stays the way it was last left. The tap that opens the viewer is
// the gesture browsers want before sound, so the first clip can play aloud.
const SOUND_KEY = "peek-muted";
function rememberedMute(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === "1";
  } catch {
    return false;
  }
}
function rememberMute(value: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, value ? "1" : "0");
  } catch {
    // A private window forgets; the session still works.
  }
}
const SWIPE = 45;

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The full-screen player. It walks the strip in the order it was given: every
 * clip of one person, then on to the next, and out of the way after the last.
 */
export function PeekViewer({
  people,
  startPersonId,
  viewer,
  now,
  onPatch,
  onRemove,
  onClose,
}: {
  people: PeekPerson[];
  startPersonId: string;
  viewer: Profile | null;
  now: number;
  onPatch: (peekId: string, patch: Partial<Peek>) => void;
  onRemove: (peekId: string) => void;
  onClose: () => void;
}) {
  // A snapshot: the strip behind may be refreshed while somebody is watching,
  // and the running order should not change under their thumb.
  const [list, setList] = useState<PeekPerson[]>(() =>
    people.filter((person) => person.peeks.length > 0),
  );
  const [pos, setPos] = useState(() => {
    const p = Math.max(
      0,
      people
        .filter((person) => person.peeks.length > 0)
        .findIndex((person) => person.id === startPersonId),
    );
    const person = people.filter((one) => one.peeks.length > 0)[p];
    const k = person
      ? Math.max(
          0,
          person.peeks.findIndex((peek) => !peek.watched),
        )
      : 0;
    return { p, k };
  });
  const [muted, setMuted] = useState(rememberedMute);
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState<"" | "report" | "remove">("");
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const viewed = useRef<Set<string>>(new Set());
  const { run } = useAsyncAction();

  const person = list[pos.p] ?? null;
  const peek = person?.peeks[pos.k] ?? null;
  const blocked = sheet || dialog !== "";

  // Nothing left to watch: every clip was removed while it was open.
  useEffect(() => {
    if (list.length === 0) onClose();
  }, [list.length, onClose]);

  const patch = useCallback(
    (id: string, delta: Partial<Peek>) => {
      setList((current) =>
        current.map((one) =>
          one.peeks.some((item) => item.id === id)
            ? {
                ...one,
                peeks: one.peeks.map((item) =>
                  item.id === id ? { ...item, ...delta } : item,
                ),
              }
            : one,
        ),
      );
      onPatch(id, delta);
    },
    [onPatch],
  );

  const next = useCallback(() => {
    setPos((current) => {
      const at = list[current.p];
      if (at && current.k + 1 < at.peeks.length)
        return { p: current.p, k: current.k + 1 };
      if (current.p + 1 < list.length) return { p: current.p + 1, k: 0 };
      return current;
    });
    const at = list[pos.p];
    const last = !at || (pos.k + 1 >= at.peeks.length && pos.p + 1 >= list.length);
    if (last) onClose();
  }, [list, pos, onClose]);

  const back = useCallback(() => {
    setPos((current) => {
      if (current.k > 0) return { p: current.p, k: current.k - 1 };
      if (current.p > 0)
        return {
          p: current.p - 1,
          k: Math.max(0, list[current.p - 1].peeks.length - 1),
        };
      return current;
    });
  }, [list]);

  // Escape and the arrow keys, unless a dialog of its own is on top.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (blocked) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, next, blocked]);

  // The clip pauses for a reply sheet or a dialog, and picks up after.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (blocked) video.pause();
    else
      void video.play().catch(() => {
        // A browser that refuses sound here still plays quietly.
        if (video.muted) return;
        video.muted = true;
        setMuted(true);
        void video.play().catch(() => undefined);
      });
  }, [blocked, muted, pos]);

  // The segment that is filling. A tick a second where motion is unwelcome,
  // a frame at a time otherwise.
  const peekId = peek?.id ?? "";
  useEffect(() => {
    const fill = fillRef.current;
    if (fill) fill.style.width = "0%";
    if (!peekId || blocked) return;
    const step = () => {
      const video = videoRef.current;
      const bar = fillRef.current;
      if (!video || !bar) return;
      const length =
        Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : CLIP_MS / 1000;
      bar.style.width =
        Math.min(100, Math.max(0, (video.currentTime / length) * 100)) + "%";
    };
    if (reducedMotion()) {
      const timer = setInterval(step, 1000);
      return () => clearInterval(timer);
    }
    let frame = requestAnimationFrame(function tick() {
      step();
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [peekId, blocked]);

  useEffect(() => {
    setFailed(false);
  }, [peekId]);

  // One view per clip per slot. The server counts a viewer once and credits
  // the re-peek that brought them, if there was one.
  const recordView = useCallback(() => {
    if (!peek) return;
    const key = peek.id + ":" + (peek.shared_by?.id ?? "");
    if (viewed.current.has(key)) return;
    viewed.current.add(key);
    api<{ views: number }>("peeks/" + peek.id + "/view", {
      method: "POST",
      body: peek.shared_by ? { via: peek.shared_by.id } : {},
    })
      .then((result) => patch(peek.id, { views: result.views, watched: 1 }))
      .catch(() => {
        // A view that did not land is not worth a word on screen.
        viewed.current.delete(key);
      });
  }, [patch, peek]);

  const like = () => {
    if (!peek) return;
    const to = peek.liked ? 0 : 1;
    patch(peek.id, {
      liked: to,
      likes: Math.max(0, peek.likes + (to ? 1 : -1)),
    });
    void run("peek-like:" + peek.id, async () => {
      try {
        await api("peeks/" + peek.id + "/like", {
          method: to ? "PUT" : "DELETE",
        });
      } catch (cause) {
        patch(peek.id, { liked: peek.liked, likes: peek.likes });
        throw cause;
      }
    });
  };

  const repeek = () => {
    if (!peek) return;
    const to = peek.repeeked ? 0 : 1;
    patch(peek.id, {
      repeeked: to,
      repeeks: Math.max(0, peek.repeeks + (to ? 1 : -1)),
    });
    void run("peek-repeek:" + peek.id, async () => {
      try {
        const result = await api<{ repeeks: number }>(
          "peeks/" + peek.id + "/repeek",
          { method: to ? "PUT" : "DELETE" },
        );
        patch(peek.id, { repeeks: result.repeeks });
        toast.success(
          to
            ? "Re-peeked. It stays on your profile as long as the original."
            : "Re-peek removed.",
        );
      } catch (cause) {
        patch(peek.id, { repeeked: peek.repeeked, repeeks: peek.repeeks });
        throw cause;
      }
    });
  };

  const drop = (id: string) => {
    void run("peek-remove:" + id, async () => {
      await api("peeks/" + id, { method: "DELETE" });
      onRemove(id);
      toast.success("Peek removed.");
      const trimmed = list
        .map((one) => ({
          ...one,
          peeks: one.peeks.filter((item) => item.id !== id),
        }))
        .filter((one) => one.peeks.length > 0);
      if (trimmed.length === 0) {
        onClose();
        return;
      }
      const here = list[pos.p]?.id ?? "";
      const at = trimmed.findIndex((one) => one.id === here);
      setList(trimmed);
      setPos(
        at === -1
          ? { p: Math.min(pos.p, trimmed.length - 1), k: 0 }
          : { p: at, k: Math.min(pos.k, trimmed[at].peeks.length - 1) },
      );
    });
  };

  if (!person || !peek) return null;

  const creator = peek.creator;
  const isOwn = !!viewer && viewer.id === creator.id;
  const canRemove = isOwn || !!viewer?.isAdmin;
  const shared = peek.shared_by;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        // The dialog centres itself with a translate; the class merger drops
        // those here so the overlay can cover the whole screen from the corner.
        className="peek-overlay top-0 left-0 translate-x-0 translate-y-0 w-full max-w-none h-full rounded-none border-0 p-0 gap-0"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">
          {"Peeks by " + creator.name}
        </DialogTitle>
        <div
          className="peek-stage"
          onTouchStart={(event) => {
            const point = event.changedTouches[0];
            touch.current = { x: point.clientX, y: point.clientY };
          }}
          onTouchEnd={(event) => {
            const start = touch.current;
            touch.current = null;
            if (!start) return;
            const point = event.changedTouches[0];
            const dx = point.clientX - start.x;
            const dy = point.clientY - start.y;
            if (Math.abs(dx) < SWIPE || Math.abs(dx) < Math.abs(dy)) return;
            if (dx < 0) next();
            else back();
          }}
        >
          <video
            key={peek.id + ":" + pos.p}
            ref={videoRef}
            className="peek-video"
            src={peek.video}
            poster={peek.poster}
            autoPlay
            muted={muted}
            playsInline
            preload="auto"
            onPlaying={recordView}
            onEnded={next}
            onError={() => setFailed(true)}
          />
          {failed && (
            <div className="peek-failed" role="alert">
              <p>This one would not play. It may have just expired.</p>
              <button className="quiet" onClick={next}>
                Next clip
              </button>
            </div>
          )}
          <div className="peek-zones">
            <button
              className="peek-zone"
              onClick={back}
              aria-label="Previous clip"
            />
            <button
              className="peek-zone"
              onClick={() =>
                setMuted((current) => {
                  rememberMute(!current);
                  return !current;
                })
              }
              aria-label={muted ? "Turn the sound on" : "Turn the sound off"}
              aria-pressed={!muted}
            />
            <button className="peek-zone" onClick={next} aria-label="Next clip" />
          </div>
          <div className="peek-top">
            <div
              className="peek-bars"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={person.peeks.length}
              aria-valuenow={pos.k + 1}
              aria-label={
                "Clip " + (pos.k + 1) + " of " + person.peeks.length
              }
            >
              {person.peeks.map((item, index) => (
                <span className="peek-bar" key={item.id + ":" + index}>
                  <span
                    className="peek-bar-fill"
                    ref={index === pos.k ? fillRef : undefined}
                    style={
                      index === pos.k
                        ? undefined
                        : { width: index < pos.k ? "100%" : "0%" }
                    }
                  />
                </span>
              ))}
            </div>
            <div className="peek-who">
              <Avatar person={creator} />
              <div className="peek-who-text">
                <b className="name-line">
                  <span className="name-text">{creator.name}</span>
                  <NameBadge person={creator} focusable={false} />
                </b>
                <span className="peek-who-meta">
                  @{creator.handle} · {age(peek.created, now)}
                </span>
                {shared && (
                  <span className="peek-shared">
                    <Repeat size={12} aria-hidden="true" />
                    {viewer && shared.id === viewer.id
                      ? "Re-peeked by you"
                      : "Re-peeked by @" + shared.handle}
                  </span>
                )}
              </div>
              <button
                className="peek-icon"
                onClick={() =>
                setMuted((current) => {
                  rememberMute(!current);
                  return !current;
                })
              }
                aria-label={muted ? "Turn the sound on" : "Turn the sound off"}
                aria-pressed={!muted}
              >
                {muted ? (
                  <VolumeX size={19} aria-hidden="true" />
                ) : (
                  <Volume2 size={19} aria-hidden="true" />
                )}
              </button>
              <button
                className="peek-icon"
                onClick={onClose}
                aria-label="Close peeks"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="peek-bottom">
            {peek.caption && <p className="peek-caption">{peek.caption}</p>}
            <div className="peek-actions">
              <button
                className={peek.liked ? "selected" : ""}
                onClick={like}
                aria-pressed={!!peek.liked}
                aria-label={
                  (peek.liked ? "Unlike" : "Like") +
                  " this peek by " +
                  creator.name
                }
              >
                <Heart
                  size={20}
                  fill={peek.liked ? "currentColor" : "none"}
                  aria-hidden="true"
                />
                {peek.likes || "Like"}
              </button>
              <button
                onClick={() => setSheet(true)}
                aria-label={
                  "Replies to this peek, " +
                  peek.replies +
                  " so far"
                }
              >
                <MessageCircle size={20} aria-hidden="true" />
                {peek.replies || "Reply"}
              </button>
              {!isOwn && (
                <button
                  className={peek.repeeked ? "selected" : ""}
                  onClick={repeek}
                  aria-pressed={!!peek.repeeked}
                  aria-label={
                    (peek.repeeked ? "Remove your re-peek of" : "Re-peek") +
                    " this peek by " +
                    creator.name
                  }
                >
                  <Repeat size={20} aria-hidden="true" />
                  {peek.repeeks || "Re-peek"}
                </button>
              )}
              <span className="peek-views">
                <Eye size={19} aria-hidden="true" />
                {peek.views}
                <span className="sr-only">
                  {" " + plural(peek.views, "view", "views")}
                </span>
              </span>
              {(canRemove || !isOwn) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="peek-more"
                      aria-label="More options for this peek"
                    >
                      <MoreHorizontal size={20} aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!isOwn && (
                      <DropdownMenuItem onSelect={() => setDialog("report")}>
                        <Flag size={15} aria-hidden="true" />
                        Report peek
                      </DropdownMenuItem>
                    )}
                    {canRemove && (
                      <DropdownMenuItem onSelect={() => setDialog("remove")}>
                        <Trash2 size={15} aria-hidden="true" />
                        {isOwn ? "Remove your peek" : "Remove this peek"}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
      {sheet && (
        <PeekReplies
          peek={peek}
          viewer={viewer}
          now={now}
          onCountChange={(id, count) => patch(id, { replies: count })}
          onClose={() => setSheet(false)}
        />
      )}
      {dialog === "report" && (
        <ReportDialog
          path={"peeks/" + peek.id + "/report"}
          onClose={() => setDialog("")}
        />
      )}
      <ConfirmDialog
        open={dialog === "remove"}
        onOpenChange={(open) => !open && setDialog("")}
        title="Remove this peek?"
        description="The clip goes now, and the numbers stay. There is no undo."
        confirmLabel="Remove it"
        onConfirm={() => {
          setDialog("");
          drop(peek.id);
        }}
      />
    </Dialog>
  );
}
