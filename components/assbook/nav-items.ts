import { Bookmark, Home, UserCheck, UserRound, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = { icon: LucideIcon; label: string; view: string };

export const navItems: NavItem[] = [
  { icon: Home, label: "The Bottom Line", view: "everyone" },
  { icon: UserCheck, label: "Following", view: "following" },
  { icon: Users, label: "People", view: "people" },
  { icon: Bookmark, label: "Saved for later", view: "saved" },
  { icon: UserRound, label: "Your backside", view: "profile" },
];

// Views that only make sense once you have an account.
export const privateViews = ["saved", "profile"];

export function viewName(view: string): string {
  return navItems.find((item) => item.view === view)?.label ?? "The Bottom Line";
}

export function viewHeading(view: string, profileName?: string): string {
  if (view === "following") return "Right behind them";
  if (view === "people") return "The community";
  if (view === "saved") return "Saved for later";
  if (view === "profile") return profileName ?? "Your backside";
  return "The Bottom Line";
}

export function viewBlurb(view: string): string {
  if (view === "following") return "A little closer to your favorite people.";
  if (view === "people") return "Everyone here, best side out. Say hello.";
  if (view === "saved") return "The posts you want to come back to.";
  if (view === "profile") return "A little personality. A different perspective.";
  return "Good people. Bad puns. Great jeans.";
}
