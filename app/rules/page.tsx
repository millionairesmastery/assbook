import type { Metadata } from "next";
import { LegalPage } from "@/components/assbook/legal/legal-page";
import { RulesContent } from "@/components/assbook/legal/rules-content";

export const metadata: Metadata = {
  title: "Community rules: Assbook",
  description:
    "The rules that keep Assbook a place people enjoy: pants on, your own photo, and be a good human.",
};

export default function RulesPage() {
  return (
    <LegalPage title="Community rules">
      <RulesContent />
    </LegalPage>
  );
}
