import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Assbook: The Bottom Line",
  description:
    "Good people. Bad puns. Great jeans. The open-source social network with a different perspective.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
