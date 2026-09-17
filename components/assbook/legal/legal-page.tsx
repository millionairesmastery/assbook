import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/assbook/landing/site-header";
import { SiteFooter } from "@/components/assbook/landing/site-footer";

// The frame around the written pages: the same header and footer as the
// landing page, and one readable column in between. These pages may scroll.
export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="legal-page">
      <SiteHeader />
      <main className="legal-main" id="main-content">
        <article className="legal-article">
          <h1>
            {title}
            <span aria-hidden="true">.</span>
          </h1>
          {children}
        </article>
        <Link className="text-link legal-back" href="/">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Assbook
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
