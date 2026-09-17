import { Code2, Home, Search, UserRound, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = { icon: LucideIcon; label: string; view: string };

/**
 * Three places to stand: the feed, the community and your own profile.
 * "Following" lives as a tab on the feed, "Saved" as a tab on your profile,
 * so the sidebar never argues with the tabs about what is highlighted.
 */
export const navItems: NavItem[] = [
  { icon: Home, label: "The Bottom Line", view: "feed" },
  { icon: Users, label: "Community", view: "community" },
  { icon: UserRound, label: "Your backside", view: "profile" },
];

/** The same places on a phone, plus search and about, in thumb order. */
export type MobileNavItem = {
  icon: LucideIcon;
  label: string;
  view?: string;
  action?: "search" | "about";
};

export const mobileNavItems: MobileNavItem[] = [
  { icon: Home, label: "Home", view: "feed" },
  { icon: Users, label: "Community", view: "community" },
  { icon: Search, label: "Search Assbook", action: "search" },
  { icon: UserRound, label: "Your profile", view: "profile" },
  { icon: Code2, label: "About Assbook", action: "about" },
];

// Views that only make sense once you have an account.
export const privateViews = ["profile"];

export type FeedTab = "everyone" | "following";
export type ProfileTab = "posts" | "saved";

export function feedTabName(tab: string): string {
  return tab === "following" ? "Following" : "Everyone";
}

/**
 * The big heading above the column. `tab` is the feed tab on the feed and the
 * profile tab on a profile, so both sets of tabs can retitle the page without
 * moving the sidebar highlight.
 */
export function viewHeading(
  view: string,
  tab: string,
  profileName?: string,
): string {
  if (view === "community") return "Meet the community";
  if (view === "profile") {
    if (tab === "saved") return "Saved for later";
    return profileName ?? "Your backside";
  }
  if (tab === "following") return "Right behind them";
  return "The Bottom Line";
}

export function viewBlurb(view: string, tab: string): string {
  if (view === "community")
    return "Everyone on Assbook. Follow a few and your Following feed fills up.";
  if (view === "profile")
    return tab === "saved"
      ? "The posts you want to come back to."
      : "A little personality. A different perspective.";
  if (tab === "following") return "A little closer to your favorite people.";
  return "Good people. Bad puns. Great jeans.";
}

/** The small monospace line above the heading. Empty means: nothing extra. */
export function viewKicker(view: string, tab: string): string {
  if (view === "community") return "SMALL WORLD. GREAT JEANS.";
  if (view === "profile") return tab === "saved" ? "" : "BEHIND THE HANDLE";
  return "THE INTERNET’S OTHER SIDE";
}
