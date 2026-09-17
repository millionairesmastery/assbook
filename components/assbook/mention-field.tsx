"use client";
import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent, RefObject } from "react";
import { Avatar } from "@/components/assbook/avatar";
import { usePersonSearch } from "@/hooks/use-person-search";
import type { Profile } from "@/lib/types";

type Field = HTMLInputElement | HTMLTextAreaElement;

// The @word the caret is inside, if any.
function activeMention(value: string, caret: number): { start: number; term: string } | null {
  const before = value.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && /[a-zA-Z0-9_@]/.test(before[at - 1])) return null;
  const term = before.slice(at + 1);
  if (!/^[a-zA-Z0-9_]{0,24}$/.test(term)) return null;
  return { start: at, term };
}

/**
 * A text field that offers people while you type an @handle, the way X does.
 * Arrow keys move, Enter or Tab picks, Escape closes. Everything else about
 * the field is the caller's: value, placeholder, limits, focus handlers.
 */
export function MentionField({
  value,
  onChange,
  multiline = false,
  menu = "below",
  fieldRef,
  onKeyDown,
  ...rest
}: {
  value: string;
  onChange: (next: string) => void;
  multiline?: boolean;
  /** Where the list opens. "above" for a field at the foot of a dialog. */
  menu?: "below" | "above";
  fieldRef?: RefObject<HTMLTextAreaElement | null>;
  onKeyDown?: (event: KeyboardEvent<Field>) => void;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement> & React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "onKeyDown"
>) {
  const own = useRef<Field | null>(null);
  const [caret, setCaret] = useState(0);
  // The highlighted row, remembered with the @word it belongs to, so a new
  // word starts at the top without an effect.
  const [highlight, setHighlight] = useState({ key: "", index: 0 });
  const [closedFor, setClosedFor] = useState("");

  const active = useMemo(() => activeMention(value, caret), [value, caret]);
  const search = usePersonSearch(active ? active.term : "");
  const people = active && active.term && search.people.length ? search.people.slice(0, 6) : [];
  const key = active ? active.start + ":" + active.term : "";
  const open = people.length > 0 && closedFor !== key;
  const index = highlight.key === key ? highlight.index : 0;
  const setIndex = (update: (n: number) => number) =>
    setHighlight({ key, index: update(index) });

  const attach = (node: Field | null) => {
    own.current = node;
    if (fieldRef) fieldRef.current = node as HTMLTextAreaElement | null;
  };

  const readCaret = () => {
    const node = own.current;
    if (node) setCaret(node.selectionStart ?? node.value.length);
  };

  const pick = (person: Profile) => {
    if (!active) return;
    const head = value.slice(0, active.start) + "@" + person.handle + " ";
    const next = head + value.slice(caret);
    onChange(next);
    setClosedFor(key);
    requestAnimationFrame(() => {
      const node = own.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(head.length, head.length);
      setCaret(head.length);
    });
  };

  const keys = (event: KeyboardEvent<Field>) => {
    if (open) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setIndex((n) => (n + 1) % people.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setIndex((n) => (n - 1 + people.length) % people.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        pick(people[index]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setClosedFor(key);
        return;
      }
    }
    onKeyDown?.(event);
  };

  const change = (event: ChangeEvent<Field>) => {
    onChange(event.target.value);
    setCaret(event.target.selectionStart ?? event.target.value.length);
  };

  const shared = {
    value,
    onChange: change,
    onKeyDown: keys,
    onKeyUp: readCaret,
    onClick: readCaret,
    "aria-autocomplete": "list" as const,
    "aria-expanded": open,
  };

  return (
    <span className="mention-wrap">
      {multiline ? (
        <textarea ref={attach} {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} {...shared} />
      ) : (
        <input ref={attach} {...(rest as React.InputHTMLAttributes<HTMLInputElement>)} {...shared} />
      )}
      {open && (
        <ul className={"mention-menu " + menu} role="listbox" aria-label="People">
          {people.map((person, n) => (
            <li key={person.id} role="option" aria-selected={n === index}>
              <button
                type="button"
                className={"mention-item" + (n === index ? " active" : "")}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(person)}
              >
                <Avatar person={person} />
                <span className="mention-who">
                  <b>{person.name}</b>
                  <span>@{person.handle}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
