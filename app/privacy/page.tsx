import type { Metadata } from "next";
import { LegalPage } from "@/components/assbook/legal/legal-page";
import { PrivacyContent } from "@/components/assbook/legal/privacy-content";

export const metadata: Metadata = {
  title: "Privacy: Assbook",
  description:
    "What Assbook stores, why it stores it, and how to get it back or have it removed.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <PrivacyContent />
    </LegalPage>
  );
}
