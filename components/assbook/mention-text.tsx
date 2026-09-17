"use client";
import { Fragment } from "react";

// The same shape the server reads: an @ and 3 to 24 handle characters, not
// inside a word or an email address.
const MENTION = /(^|[^a-zA-Z0-9_@])@([a-zA-Z0-9_]{3,24})(?![a-zA-Z0-9_])/g;

/**
 * Text with every @handle turned into a link to that profile. With `onVisit`
 * the link stays inside the app; without it the address bar takes over.
 */
export function MentionText({
  text,
  onVisit,
}: {
  text: string;
  onVisit?: (handle: string) => void;
}) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(MENTION)) {
    const at = (match.index ?? 0) + match[1].length;
    if (at > last) parts.push(<Fragment key={key++}>{text.slice(last, at)}</Fragment>);
    const handle = match[2];
    parts.push(
      <a
        key={key++}
        className="mention"
        href={"/@" + handle.toLowerCase()}
        onClick={(event) => {
          if (!onVisit) return;
          event.preventDefault();
          event.stopPropagation();
          onVisit(handle.toLowerCase());
        }}
      >
        @{handle}
      </a>,
    );
    last = at + handle.length + 1;
  }
  if (last < text.length) parts.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return <>{parts}</>;
}
