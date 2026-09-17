import type { Metadata } from "next";
import { LegalPage } from "@/components/assbook/legal/legal-page";

export const metadata: Metadata = {
  title: "About: Assbook",
  description:
    "What Assbook is, why the profile photo is a fully clothed behind, how the community works, and how it is kept safe.",
};

export default function AboutPage() {
  return (
    <LegalPage title="About Assbook">
      <p>
        Assbook is a small social network with one ridiculous rule: your
        profile photo is your own fully clothed behind. Jeans, a skirt, shorts,
        a suit, whatever you wear. Nobody sees your face on your profile, and
        nobody sees any skin either. The joke is the website, never a person.
      </p>
      <h2>Why a behind?</h2>
      <p>
        Because it turns the usual social network inside out. There is no face
        to judge, no filter to perfect, and no way to take yourself too
        seriously. What is left is what people actually say: posts, replies,
        likes, bookmarks and the people worth following. Everyone starts from
        the same slightly absurd place, and it turns out that is a good place
        to be kind from.
      </p>
      <h2>What you can do</h2>
      <p>
        Post text and photos, reply, like and save posts, follow people, and
        keep a profile with a name, a bio and a link. The main feed shows
        everyone, the Following tab shows the people you chose, and the
        community page lists everybody. Search finds people by name or handle.
        Once a month, the most liked posts get a small moment of glory in the
        Bums of the month.
      </p>
      <h2>How it is kept safe</h2>
      <p>
        Every photo is checked automatically before it is stored. Nudity and
        sexual content are rejected everywhere; a profile photo that is not a
        fully clothed behind (underwear and swimwear do not count) is rejected;
        anything the check is unsure about waits for a moderator. Members can report any post and block any account, and
        every report is read by a person. Members must be 18 or older. The
        dress code is in the Community rules; the full picture is in the Terms
        and the Privacy notice.
      </p>
      <h2>Who makes it</h2>
      <p>
        Assbook is built and run by a small team that reads its own inbox. The
        application is open source under the MIT licence, so anyone can read
        the code, run their own edition, or contribute. The operated edition at
        assbook.app is a beta: it is free to join, and it will keep changing.
      </p>
      <h2>Get in touch</h2>
      <p>
        General questions: hello@assbook.app. Account matters:
        accounts@assbook.app. Something on the site: report it from the post
        menu, which reaches the moderation team fastest.
      </p>
    </LegalPage>
  );
}
