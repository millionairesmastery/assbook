import { BadgeCheck } from "lucide-react";

/**
 * Marks the one account that speaks for Assbook itself. Sits next to a name on
 * posts, in people rows and on the profile header.
 */
export function OfficialBadge() {
  return (
    <span className="tiny-badge official-badge">
      <BadgeCheck size={11} aria-hidden="true" />
      Official
    </span>
  );
}
