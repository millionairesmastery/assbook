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
