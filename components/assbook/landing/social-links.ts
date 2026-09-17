import type { ComponentType } from "react";
import {
  InstagramIcon,
  TikTokIcon,
  XIcon,
  YouTubeIcon,
} from "./social-icons";

export type SocialLink = {
  name: string;
  /** Empty until the owner has an account there. Empty means the icon is not
   *  rendered at all, so the footer never carries a link to nowhere. */
  href: string;
  icon: ComponentType<{ size?: number }>;
};

export const socialLinks: SocialLink[] = [
  { name: "Instagram", href: "", icon: InstagramIcon },
  { name: "TikTok", href: "", icon: TikTokIcon },
  { name: "X", href: "", icon: XIcon },
  { name: "YouTube", href: "", icon: YouTubeIcon },
];
