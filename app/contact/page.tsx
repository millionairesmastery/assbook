import type { Metadata } from "next";
import { LegalPage } from "@/components/assbook/legal/legal-page";

export const metadata: Metadata = {
  title: "Contact: Assbook",
  description:
    "How to reach the people behind Assbook about questions, accounts and moderation.",
};

export default function ContactPage() {
  return (
    <LegalPage title="Contact">
      <p>
        Assbook is run by a small team that reads its own inbox. Write to us in
        plain words and we will do the same back, usually within a few working
        days.
      </p>
      <h2>General questions</h2>
      <p>
        <a href="mailto:hello@assbook.app">hello@assbook.app</a>
      </p>
      <h2>Account problems</h2>
      <p>
        Lost passwords, verification trouble, closing an account or getting a
        copy of your data: <a href="mailto:accounts@assbook.app">accounts@assbook.app</a>
      </p>
      <h2>Something on the site</h2>
      <p>
        Report a post from its menu; the moderation team reads every report.
        That route gives us the post itself, which is far quicker than an email
        describing it.
      </p>
    </LegalPage>
  );
}
