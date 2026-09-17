"use client";
import { Search, X } from "lucide-react";
import type { RefObject } from "react";

/**
 * One search field, rendered in the topbar on wide screens and above the feed
 * on small ones. Both share the same change handler, so both behave the same
 * way for the view and the URL.
 */
export function SearchField({
  value,
  onChange,
  variant,
  inputRef,
}: {
  value: string;
  onChange: (next: string) => void;
  variant: "topbar" | "mobile";
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const topbar = variant === "topbar";
  return (
    <div className={topbar ? "searchbox" : "mobile-search"}>
      <Search size={topbar ? 18 : 17} aria-hidden="true" />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
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
    </div>
  );
}
