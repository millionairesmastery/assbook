import { BehindMark } from "@/components/assbook/behind-mark";

/** The ring around somebody with a live peek: orange when there is something
 *  new behind it, grey once it has all been watched. */
export type PeekRing = "" | "fresh" | "watched" | "empty";

export function Avatar({
  person,
  large = false,
  ring = "",
  round = false,
}: {
  person?: { avatar?: string | null; handle?: string };
  large?: boolean;
  ring?: PeekRing;
  round?: boolean;
}) {
  const size = large ? 76 : 43;
  const face = (
    <span
      className={
        "avatar " + (large ? "large " : "") + (round ? "is-round " : "")
      }
    >
      {person?.avatar ? (
        <img
          src={person.avatar}
          alt={(person.handle ?? "This person") + "’s fully clothed profile photo"}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <BehindMark seed={person?.handle ?? ""} size={large ? 48 : 28} />
      )}
    </span>
  );
  if (!ring) return face;
  return (
    <span className={"peek-ring is-" + ring + (round ? " is-round" : "")}>
      {face}
    </span>
  );
}
