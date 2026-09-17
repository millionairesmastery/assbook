import type { Metadata } from "next";
import { LegalPage } from "@/components/assbook/legal/legal-page";
import { TermsContent } from "@/components/assbook/legal/terms-content";

export const metadata: Metadata = {
  title: "Terms of service: Assbook",
  description:
    "The agreement between you and Assbook: who can join, what you post, and how accounts end.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service">
      <TermsContent />
    </LegalPage>
  );
}
