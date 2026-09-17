import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/assbook/legal/legal-page";

export const metadata: Metadata = { title: "No such backside: Assbook" };

export default function NotFound() {
  return (
    <LegalPage title="No such backside.">
      <p>
        There is nothing at this address. The handle may have a typo, or the
        page moved on. The feed is right where you left it.
      </p>
      <p>
        <Link href="/">Back to the Bottom Line</Link>
      </p>
    </LegalPage>
  );
}
