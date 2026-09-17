import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "cloudflare:workers";
import Assbook from "../assbook";

export const dynamic = "force-dynamic";

type Params = { handle: string };
type Row = { handle: string; name: string; bio: string; avatar: string | null };

// /@handle is a profile. Anything else at this level is not ours.
function handleFrom(param: string) {
  const raw = decodeURIComponent(param);
  if (!raw.startsWith("@")) return null;
  const handle = raw.slice(1).toLowerCase();
  return /^[a-z0-9_]{3,24}$/.test(handle) ? handle : null;
}

async function lookup(handle: string) {
  if (!env.DB) return null;
  return env.DB.prepare("SELECT handle,name,bio,avatar FROM users WHERE handle=?")
    .bind(handle)
    .first<Row>();
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const handle = handleFrom((await params).handle);
  const row = handle ? await lookup(handle) : null;
  if (!row) return { title: "No such backside: Assbook" };
  const title = row.name + " (@" + row.handle + ") on Assbook";
  const description = row.bio || "A fully clothed behind on Assbook.";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: "/@" + row.handle,
      type: "profile",
      ...(row.avatar ? { images: [{ url: row.avatar, alt: row.name + "'s profile photo" }] } : {}),
    },
    twitter: { card: row.avatar ? "summary" : "summary_large_image", title, description },
  };
}

export default async function ProfilePage({ params }: { params: Promise<Params> }) {
  const handle = handleFrom((await params).handle);
  const row = handle ? await lookup(handle) : null;
  if (!row) notFound();
  return <Assbook initialProfile={row.handle} />;
}
