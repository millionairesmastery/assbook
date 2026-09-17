"use client";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";
import { Search, X } from "lucide-react";
import { Avatar } from "@/components/assbook/avatar";
import { OfficialBadge } from "@/components/assbook/official-badge";
import type { Profile } from "@/lib/types";

const BIO_PREVIEW = 60;

function preview(bio: string): string {
  const text = bio.trim();
  if (text.length <= BIO_PREVIEW) return text;
  return text.slice(0, BIO_PREVIEW).trimEnd() + "…";
}

/**
 * One search field, rendered in the topbar on wide screens and above the feed
 * on small ones. Both share the same change handler, so both behave the same
 * way for the view and the URL. The people matching the term drop down under
 * whichever field you are typing in; pressing Enter without picking one runs
 * the ordinary post search.
 */
export function SearchField({
  value,
  onChange,
  variant,
  inputRef,
  people,
  searched,
  onSelectPerson,
}: {
  value: string;
  onChange: (next: string) => void;
  variant: "topbar" | "mobile";
  inputRef?: RefObject<HTMLInputElement | null>;
  people: Profile[];
  searched: boolean;
  onSelectPerson: (handle: string) => void;
}) {
  const topbar = variant === "topbar";
  const listId = "people-typeahead-" + variant;
  const shell = useRef<HTMLDivElement>(null);
  // The highlight and the dismissal belong to one term. A new term is a new
  // question, so the state comes back fresh without a round trip through an
  // effect.
  const [picked, setPicked] = useState({
    term: "",
    highlight: -1,
    dismissed: false,
  });
  const state =
    picked.term === value
      ? picked
      : { term: value, highlight: -1, dismissed: false };
  const { highlight, dismissed } = state;
  const update = (patch: { highlight?: number; dismissed?: boolean }) =>
    setPicked({ ...state, ...patch });

  const open = searched && !dismissed;
  const active = highlight >= 0 && highlight < people.length ? highlight : -1;

  // A click anywhere else puts the list away.
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && shell.current?.contains(target)) return;
      setPicked({ term: value, highlight: -1, dismissed: true });
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open, value]);

  const choose = (person: Profile) => {
    update({ dismissed: true, highlight: -1 });
    onSelectPerson(person.handle);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (!open) return;
      event.preventDefault();
      update({ dismissed: true, highlight: -1 });
      return;
    }
    if (event.key === "Enter") {
      if (open && active >= 0) {
        event.preventDefault();
        choose(people[active]);
        return;
      }
      // No row picked: leave the post search to do its work and get the
      // list out of the way of the results.
      update({ dismissed: true, highlight: -1 });
      return;
    }
    if (event.key === "Tab") {
      update({ dismissed: true });
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (!searched || !people.length) return;
    event.preventDefault();
    const last = people.length - 1;
    const down = event.key === "ArrowDown";
    if (dismissed) {
      update({ dismissed: false, highlight: down ? 0 : last });
      return;
    }
    update({
      highlight: down
        ? active >= last
          ? 0
          : active + 1
        : active <= 0
          ? last
          : active - 1,
    });
  };

  return (
    <div className={topbar ? "searchbox" : "mobile-search"} ref={shell}>
      <Search size={topbar ? 18 : 17} aria-hidden="true" />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          active >= 0 ? listId + "-option-" + active : undefined
        }
        autoComplete="off"
        aria-label="Search Assbook"
        placeholder={
          topbar ? "Find your people. From behind." : "Search the backside…"
        }
      />
      {value && (
        <button
          type="button"
          className="search-clear"
          aria-label="Clear search"
          onClick={() => onChange("")}
        >
          <X size={15} />
        </button>
      )}
      {open && (
        <ul className="typeahead" id={listId} role="listbox" aria-label="People">
          {people.length === 0 ? (
            <li className="typeahead-empty" role="presentation">
              No one by that name yet.
            </li>
          ) : (
            people.map((person, index) => (
              <li
                key={person.id}
                id={listId + "-option-" + index}
                role="option"
                aria-selected={index === active}
                className={
                  "typeahead-row " + (index === active ? "is-active" : "")
                }
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => update({ highlight: index })}
                onClick={() => choose(person)}
              >
                <Avatar person={person} />
                <span className="typeahead-text">
                  <b>
                    <span className="name-text">{person.name}</span>
                    {person.official === 1 && <OfficialBadge focusable={false} />}
                  </b>
                  <span className="person-meta">@{person.handle}</span>
                  {person.bio.trim() && (
                    <span className="typeahead-bio">{preview(person.bio)}</span>
                  )}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
