"use client";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type BadgeKind = "official" | "user" | "business";

const LABELS: Record<BadgeKind, string> = {
  official: "Official Assbook account",
  user: "Verified person",
  business: "Verified business",
};

// Three seals, drawn to fill the badge exactly so the mark sits dead centre.
// Official and verified share the circle; only the colour tells them apart.
function Seal({ kind }: { kind: BadgeKind }) {
  if (kind === "official")
    return (
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#e35a2f" />
        <path d="M6.3 10.3l2.4 2.4 5-5.2" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (kind === "user")
    return (
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#2456d6" />
        <path d="M6.3 10.3l2.4 2.4 5-5.2" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <rect x="1" y="1" width="18" height="18" rx="5" fill="#334155" />
      <path d="M4.5 8.2l1.2-3h8.6l1.2 3z" fill="#fff" />
      <path d="M5.5 8.6h9v6.4h-9z" fill="#fff" opacity="0.92" />
      <rect x="8.6" y="10.6" width="2.8" height="4.4" fill="#334155" />
    </svg>
  );
}

/**
 * The seal after a name: the site's own account, a verified person, or a
 * verified business. Explains itself in a tooltip on hover, focus and tap. It
 * lives inside name buttons, so it is a focusable span rather than a nested
 * button, and a tap on it stays put instead of opening the profile.
 */
export function AccountBadge({ kind, focusable = true }: { kind: BadgeKind; focusable?: boolean }) {
  const [open, setOpen] = useState(false);
  const label = LABELS[kind];
  const className = "account-badge is-" + kind;
  if (!focusable)
    return (
      <span className={className} role="img" aria-label={label}>
        <Seal kind={kind} />
      </span>
    );
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <span
            className={className}
            role="img"
            aria-label={label}
            tabIndex={0}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOpen((current) => !current);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              setOpen((current) => !current);
            }}
          >
            <Seal kind={kind} />
          </span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Picks the badge for a person: official first, then their verification. */
export function badgeFor(person: { official?: number | null; verified?: string | null }): BadgeKind | null {
  if (person.official === 1) return "official";
  if (person.verified === "user" || person.verified === "business") return person.verified;
  return null;
}

export function NameBadge({
  person,
  focusable = true,
}: {
  person: { official?: number | null; verified?: string | null };
  focusable?: boolean;
}) {
  const kind = badgeFor(person);
  return kind ? <AccountBadge kind={kind} focusable={focusable} /> : null;
}
