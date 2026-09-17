"use client";
import { useEffect, useState } from "react";
import { Eye, Heart, MessageCircle } from "lucide-react";
import { api, isAbortError } from "@/lib/api-client";
import { age, plural } from "@/lib/format";

type ArchivePeek = {
  id: string;
  caption: string;
  frame: string;
  created: number;
  likes: number;
  replies: number;
  views: number;
};

/**
 * Your own peeks after the fact. The clips are long gone; what they collected
 * is still yours to look at. A quiet extra, so a failure just hides it.
 */
export function PeekArchive({ now }: { now: number }) {
  const [peeks, setPeeks] = useState<ArchivePeek[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    api<{ peeks: ArchivePeek[] }>("peeks/archive", {
      signal: controller.signal,
    })
      .then((data) => setPeeks(data.peeks.slice(0, 5)))
      .catch((cause: unknown) => {
        if (!isAbortError(cause)) setPeeks([]);
      });
    return () => controller.abort();
  }, []);

  if (peeks.length === 0) return null;

  return (
    <section className="peek-archive card" aria-label="Your peeks">
      <div className="eyebrow">YOUR PEEKS ↓</div>
      <ul>
        {peeks.map((peek) => (
          <li key={peek.id}>
            <img
              className="peek-archive-frame"
              src={peek.frame}
              alt={
                peek.caption
                  ? "Frame from your peek: " + peek.caption
                  : "Frame from your peek from " + age(peek.created, now)
              }
              loading="lazy"
              decoding="async"
            />
            <span className="peek-archive-when">{age(peek.created, now)}</span>
            <span className="peek-archive-counts">
              <span>
                <Eye size={14} aria-hidden="true" />
                {peek.views}
                <span className="sr-only">
                  {" " + plural(peek.views, "view", "views")}
                </span>
              </span>
              <span>
                <Heart size={14} aria-hidden="true" />
                {peek.likes}
                <span className="sr-only">
                  {" " + plural(peek.likes, "like", "likes")}
                </span>
              </span>
              <span>
                <MessageCircle size={14} aria-hidden="true" />
                {peek.replies}
                <span className="sr-only">
                  {" " + plural(peek.replies, "reply", "replies")}
                </span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
