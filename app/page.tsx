import { cookies } from "next/headers";
import Assbook from "./assbook";
export const dynamic = "force-dynamic";
// A request with no session cookie and no deep link belongs to a visitor, so
// the landing page is rendered on the server: crawlers and first-time
// visitors get real content in the first response.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const jar = await cookies();
  const token = jar.get("assbook_session")?.value ?? "";
  const signedIn = /^[a-f0-9-]{72}$/.test(token);
  const deepLink = !!(params.post || params.profile || params.auth);
  return <Assbook knownVisitor={!signedIn && !deepLink} />;
}
