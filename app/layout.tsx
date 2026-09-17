import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import "./globals.css";
import { ReloadOnStaleChunk } from "@/components/assbook/reload-on-stale-chunk";
const description =
  "Good people. Bad puns. Great jeans. A small social network with one ridiculous rule: your profile photo is your own fully clothed behind.";
function origin() {
  try {
    return new URL(env.APP_ORIGIN);
  } catch {
    return new URL("https://assbook.app");
  }
}
export const metadata: Metadata = {
  metadataBase: origin(),
  title: "Assbook: The Bottom Line",
  description,
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    siteName: "Assbook",
    title: "Assbook: The Bottom Line",
    description,
    url: "/",
    images: [{ url: "/street-style-friends.png", width: 1384, height: 970, alt: "Friends seen from behind, fully clothed, on a city street" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Assbook: The Bottom Line",
    description,
    images: ["/street-style-friends.png"],
  },
  robots: { index: true, follow: true },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ReloadOnStaleChunk />
        {children}
      </body>
    </html>
  );
}
