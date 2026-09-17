"use client";
import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const LABEL = "Official Assbook account";

/**
 * Marks the one account that speaks for Assbook itself. A small round check
 * that sits inline after a name, with the explanation in a tooltip: on hover,
 * on keyboard focus and on a tap. It lives inside name buttons, so it is a
 * focusable span rather than a nested button, and a tap on it stays put
 * instead of opening the profile underneath.
 */
export function OfficialBadge({ focusable = true }: { focusable?: boolean }) {
  const [open, setOpen] = useState(false);
  // Inside a listbox option nothing else may take focus, so there the badge is
  // a plain mark with its name still read out.
  if (!focusable)
    return (
      <span className="official-badge" role="img" aria-label={LABEL}>
        <BadgeCheck size={13} aria-hidden="true" />
      </span>
    );
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <span
            className="official-badge"
            role="img"
            aria-label={LABEL}
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
            <BadgeCheck size={13} aria-hidden="true" />
          </span>
        </TooltipTrigger>
        <TooltipContent>{LABEL}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
