"use client";
import type { RefObject } from "react";
import { ArrowRight, ImagePlus, Loader2, X } from "lucide-react";
import { Avatar } from "@/components/assbook/avatar";
import type { Profile } from "@/lib/types";

export function Composer({
  user,
  draft,
  onDraftChange,
  image,
  onRemoveImage,
  onAddPhoto,
  onSubmit,
  submitting,
  textareaRef,
}: {
  user: Profile | null;
  draft: string;
  onDraftChange: (next: string) => void;
  image: string | null;
  onRemoveImage: () => void;
  onAddPhoto: () => void;
  onSubmit: () => void;
  submitting: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <section className="composer card" id="composer">
      <div className="compose-top">
        <Avatar person={user ?? undefined} />
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          maxLength={500}
          aria-label="Write a post"
          placeholder="What’s happening behind the scenes?"
        />
      </div>
      {image && (
        <div className="attachment">
          <img
            src={image}
            alt="Your attached photo"
            loading="lazy"
            decoding="async"
          />
          <button
            className="icon-button"
            aria-label="Remove attached photo"
            onClick={onRemoveImage}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="compose-bottom">
        <button className="quiet" onClick={onAddPhoto}>
          <ImagePlus size={18} aria-hidden="true" />
          Photo
        </button>
        <span>
          {draft.length
            ? draft.length + "/500"
            : "Keep it cheeky. Keep it clothed."}
        </span>
        <button
          className="primary"
          disabled={submitting || (!draft.trim() && !image)}
          onClick={onSubmit}
        >
          {submitting && <Loader2 className="spin" size={15} aria-hidden="true" />}
          Post <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
