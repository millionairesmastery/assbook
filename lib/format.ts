// Pure formatting helpers. `age` takes the current time so components stay
// render-pure and can re-render on a tick instead of reading the clock.
export const MINUTE = 60000;

export function age(time: number, now: number): string {
  if (time < 100) return "Sample post";
  const mins = Math.max(0, Math.floor((now - time) / MINUTE));
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + "m";
  if (mins < 1440) return Math.floor(mins / 60) + "h";
  return new Date(time).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

// A profile link, but only if it is really a web address. Anything else (an
// old row, a scheme we do not want to hand to the browser) comes back empty.
export function webLink(link?: string | null): string {
  const url = (link ?? "").trim();
  return /^https?:\/\/[^\s<>"']+$/i.test(url) ? url : "";
}

// "assbook.app/about": the same address, without the parts nobody reads.
export function linkLabel(link: string): string {
  return link.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

// "Joined March 2026" for a profile header. Seeded sample accounts carry a
// placeholder timestamp, so they get a gentler line instead of 1970.
export function joined(time: number): string {
  if (!time || time < 100) return "Here since the beginning";
  return (
    "Joined " +
    new Date(time).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    })
  );
}
